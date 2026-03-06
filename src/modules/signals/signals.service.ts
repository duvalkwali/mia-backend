/**
 * Signals service for extracting and managing customer signals.
 * Implements a hybrid extraction strategy combining rules-based and AI-powered methods.
 */

import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { TenantContext } from '../../shared/types/common.types';
import { ExtractSignalsInput, SignalExtractionResult } from './signals.types';
import { RulesExtractor } from './extractors/rulesExtractor';
import { AIExtractor } from './extractors/aiExtractor';
import logger from '../../config/logger';
import { FunnelStage, Intent, Sentiment, Urgency } from '@prisma/client';
import { AI_MODELS } from '../../config/openai';

/**
 * Service class for signal extraction and management operations.
 */
export class SignalsService {
  private rulesExtractor = new RulesExtractor();
  private aiExtractor = new AIExtractor();
  
  private readonly CONFIDENCE_THRESHOLD = 0.7; // Require 70% confidence from rules

  /**
   * COST OPTIMIZATION: Hybrid extraction strategy
   * 
   * 1. Try rules-based extraction (FREE)
   * 2. If confidence < threshold, use AI (CHEAP: gpt-4o-mini)
   * 3. Track cost and method for analytics
   */
  async extractSignals(
    ctx: TenantContext,
    input: ExtractSignalsInput
  ): Promise<SignalExtractionResult> {
    // Get or create contact
    const contact = await this.getOrCreateContact(
      ctx,
      input.contactExternalId,
      input.platform,
      input.contactName
    );

    // Step 1: Try rules-based extraction (FREE)
    const rulesResult = this.rulesExtractor.extract(input.messageText);

    let finalSignals = rulesResult;
    let extractionMethod: 'rules' | 'ai' | 'hybrid' = 'rules';
    let extractionCost = 0;

    // Step 2: If confidence is low, use AI
    if (rulesResult.confidence < this.CONFIDENCE_THRESHOLD) {
      logger.info('Rules extraction confidence low, falling back to AI', {
        confidence: rulesResult.confidence,
        tenantId: ctx.tenantId,
      });

      try {
        const aiResult = await this.aiExtractor.extract(input.messageText);
        finalSignals = aiResult.signals;
        extractionCost = aiResult.cost;
        extractionMethod = 'ai';
      } catch (error) {
        // AI extraction failed, use rules result anyway
        logger.warn('AI extraction failed, using rules result', { error });
        extractionMethod = 'hybrid';
      }
    }

    // Store ONLY structured signals (no raw message)
    const signal = await prisma.contactSignal.create({
      data: {
        contactId: contact.id,
        intent: finalSignals.intent as Intent,
        sentiment: finalSignals.sentiment as Sentiment,
        urgency: finalSignals.urgency as Urgency,
        funnelStage: finalSignals.funnelStage as FunnelStage,
        keyTopics: finalSignals.keyTopics,
        questionsAsked: finalSignals.questionsAsked,
        objectionsRaised: finalSignals.objectionsRaised,
        extractionMethod,
        extractionCost,
      },
    });

    // Track cost if AI was used
    if (extractionCost > 0) {
      await prisma.costTracking.create({
        data: {
          tenantId: ctx.tenantId,
          operation: 'signal_extraction',
          modelUsed: AI_MODELS.EXTRACTION,
          tokensUsed: 0, // Local Ollama — token count not billed
          costUsd: extractionCost,
        },
      });
    }

    logger.info('Signals extracted', {
      tenantId: ctx.tenantId,
      contactId: contact.id,
      intent: finalSignals.intent,
      method: extractionMethod,
      cost: extractionCost,
      // NEVER log: messageText
    });

    // messageText is now out of scope and will be garbage collected
    return {
      contactId: contact.id,
      signals: {
        intent: signal.intent,
        sentiment: signal.sentiment,
        urgency: signal.urgency,
        funnelStage: signal.funnelStage,
        keyTopics: signal.keyTopics,
        questionsAsked: signal.questionsAsked,
        objectionsRaised: signal.objectionsRaised,
      },
      extractionMethod,
      cost: extractionCost,
    };
  }

  /**
   * Retrieves or creates a contact record based on external ID and platform.
   * Ensures contacts are properly scoped to tenants.
   *
   * @param ctx - Tenant context
   * @param externalId - External platform identifier
   * @param platform - Platform type (WHATSAPP or INSTAGRAM)
   * @param name - Optional contact name
   * @returns Contact record
   */
  private async getOrCreateContact(
    ctx: TenantContext,
    externalId: string,
    platform: 'WHATSAPP' | 'INSTAGRAM',
    name?: string
  ) {
    let contact = await prisma.contact.findUnique({
      where: {
        tenantId_externalId_platform: {
          tenantId: ctx.tenantId,
          externalId,
          platform,
        },
      },
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          tenantId: ctx.tenantId,
          externalId,
          platform,
          name: name || externalId,
        },
      });

      logger.info('Contact created', {
        tenantId: ctx.tenantId,
        contactId: contact.id,
      });
    }

    return contact;
  }

  /**
   * Retrieves the signal history for a specific contact.
   * Returns the last 10 signals ordered by extraction time.
   *
   * @param ctx - Tenant context
   * @param contactId - Internal contact ID
   * @returns Array of signal records
   */
  async getContactSignals(ctx: TenantContext, contactId: string) {
    // Verify contact belongs to tenant
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        tenantId: ctx.tenantId,
      },
    });

    if (!contact) {
      throw new AppError(404, 'CONTACT_NOT_FOUND', 'Contact not found');
    }

    const signals = await prisma.contactSignal.findMany({
      where: { contactId },
      orderBy: { extractedAt: 'desc' },
      take: 10,
    });

    return signals;
  }

  /**
   * Gets the current state (most recent signal) for a contact.
   * Returns null if no signals exist for the contact.
   *
   * @param ctx - Tenant context
   * @param contactId - Internal contact ID
   * @returns Most recent signal or null
   */
  async getCurrentContactState(ctx: TenantContext, contactId: string) {
    const signals = await this.getContactSignals(ctx, contactId);

    if (signals.length === 0) {
      return null;
    }

    // Return most recent signal as current state
    return signals[0];
  }

  /**
   * List all signals for the tenant (used by the frontend signals table).
   * Joins with contact to return name and externalId.
   */
  async listSignals(ctx: TenantContext) {
    const signals = await prisma.contactSignal.findMany({
      where: { contact: { tenantId: ctx.tenantId } },
      include: { contact: true },
      orderBy: { extractedAt: 'desc' },
      take: 50,
    });

    return signals.map((s) => ({
      id: s.id,
      contactName: s.contact.name || s.contact.externalId,
      contactExternalId: s.contact.externalId,
      intent: s.intent,
      sentiment: s.sentiment,
      urgency: s.urgency,
      funnelStage: s.funnelStage,
      createdAt: s.extractedAt,
    }));
  }

  /**
   * Generate a reply from an existing signal.
   * Looks up the signal, finds its contact, then triggers reply generation.
   */
  async generateReplyFromSignal(
    ctx: TenantContext,
    signalId: string,
    replyService: { generateReply: (ctx: TenantContext, input: { contactId: string; incomingMessage: string }) => Promise<unknown> }
  ) {
    const signal = await prisma.contactSignal.findUnique({
      where: { id: signalId },
      include: { contact: true },
    });

    if (!signal || signal.contact.tenantId !== ctx.tenantId) {
      throw new AppError(404, 'SIGNAL_NOT_FOUND', 'Signal not found');
    }

    // Build a summary message from the signal data to drive generation
    const messageSummary = [
      signal.keyTopics.join(', '),
      signal.questionsAsked[0] || '',
    ].filter(Boolean).join(' ') || 'follow up on previous message';

    return replyService.generateReply(ctx, {
      contactId: signal.contact.externalId,
      incomingMessage: messageSummary,
    });
  }
}
