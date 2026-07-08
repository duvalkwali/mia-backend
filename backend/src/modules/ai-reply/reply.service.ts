/**
 * ReplyService
 *
 * Core business logic for generating and managing AI replies.
 * Responsibilities include: building prompts, calling the AI model,
 * persisting generated replies and tracking costs, and maintaining
 * ephemeral conversation context for better subsequent responses.
 */
import openai, { AI_MODELS, calculateCost } from '../../config/openai';
import { env } from '../../config/env';
import prisma from '../../config/database';
import redisClient from '../../config/redis';
import { AppError } from '../../middleware/errorHandler';
import { TenantContext } from '../../shared/types/common.types';
import { GenerateReplyInput, GeneratedReplyData, EditReplyInput } from './reply.types';
import { SignalsService } from '../signals/signals.service';
import { BusinessService } from '../business/business.service';
import { StyleService } from '../style/style.service';
import { WhatsAppService } from '../webhooks/whatsapp.service';
import { PromptBuilder } from './promptBuilder';
import logger from '../../config/logger';

export class ReplyService {
  private signalsService = new SignalsService();
  private businessService = new BusinessService();
  private styleService = new StyleService();
  private promptBuilder = new PromptBuilder();

  /**
   * Generate a reply for a contact message.
   *
   * Steps:
   * 1) Extract signals (rules or AI)
   * 2) Collect context (business, style profile, current signals, ephemeral context)
   * 3) Build prompt and call the AI model to generate the reply
   * 4) Persist the reply, track costs, and update ephemeral context
   *
   * Returns a compact GeneratedReplyData used by API responses.
   */
  async generateReply(
    ctx: TenantContext,
    input: GenerateReplyInput
  ): Promise<GeneratedReplyData> {
    const startTime = Date.now();

    // 1. Extract signals from incoming message (may use cheap model or rules)
    const extraction = await this.signalsService.extractSignals(ctx, {
      contactExternalId: input.contactId,
      platform: 'WHATSAPP', // For MVP
      messageText: input.incomingMessage,
    });

    // 2. Get all required context
    const [business, styleProfile, currentSignal, ephemeralContext] = await Promise.all([
      this.businessService.getBusiness(ctx),
      this.styleService.getStyleProfile(ctx),
      this.signalsService.getCurrentContactState(ctx, extraction.contactId),
      this.getEphemeralContext(ctx, extraction.contactId),
    ]);

    if (!currentSignal) {
      throw new AppError(500, 'NO_SIGNAL', 'Failed to extract signals');
    }

    logger.info('Reply: context loaded', {
      tenantId: ctx.tenantId,
      contactId: extraction.contactId,
      intent: currentSignal.intent,
      sentiment: currentSignal.sentiment,
      urgency: currentSignal.urgency,
      funnelStage: currentSignal.funnelStage,
    });

    // 3. Build prompt (uses template caching)
    const prompt = await this.promptBuilder.build(
      business,
      styleProfile,
      currentSignal,
      ephemeralContext
    );

    logger.info('Reply: prompt built — calling AI', {
      tenantId: ctx.tenantId,
      model: AI_MODELS.GENERATION,
      systemInstructionLength: prompt.systemInstruction.length,
      userMessageLength: prompt.userMessage.length,
    });

    // 4. Generate reply using AI (GPT-4o for quality)
    const { generatedText, cost, tokensUsed } = await this.callAI(prompt);

    // 5. Calculate confidence score
    const confidence = this.calculateConfidence(generatedText, styleProfile);

    // 6. Store generated reply
    const reply = await prisma.generatedReply.create({
      data: {
        contactId: extraction.contactId,
        generatedText,
        confidence,
        status: 'PENDING',
        promptVersion: 'v1.0',
        modelUsed: AI_MODELS.GENERATION,
        tokensUsed,
        latencyMs: Date.now() - startTime,
        generationCost: cost,
      },
    });

    // 7. Track cost
    await prisma.costTracking.create({
      data: {
        tenantId: ctx.tenantId,
        operation: 'reply_generation',
        modelUsed: AI_MODELS.GENERATION,
        tokensUsed,
        costUsd: cost,
      },
    });

    // 8. Update ephemeral context
    await this.updateEphemeralContext(ctx, extraction.contactId, {
      direction: 'inbound',
      summary: `Intent: ${currentSignal.intent}, Sentiment: ${currentSignal.sentiment}`,
      timestamp: new Date(),
    });

    logger.info('Reply generated', {
      tenantId: ctx.tenantId,
      replyId: reply.id,
      confidence,
      latencyMs: reply.latencyMs,
      costUsd: cost,
      extractionCost: extraction.cost,
      totalCost: cost + extraction.cost,
    });

    return {
      replyId: reply.id,
      generatedText: reply.generatedText,
      confidence: reply.confidence,
      contactId: extraction.contactId,
      status: reply.status,
      cost: cost + extraction.cost, // Total cost (extraction + generation)
    };
  }

  /**
   * COST OPTIMIZATION: Use GPT-4o for quality reply generation
   */
  private async callAI(prompt: { systemInstruction: string; userMessage: string }): Promise<{
    generatedText: string;
    cost: number;
    tokensUsed: number;
  }> {
    const callStart = Date.now();
    logger.info('AI: calling model', { model: AI_MODELS.GENERATION });

    try {
      const response = await openai.chat.completions.create({
        model: AI_MODELS.GENERATION,
        messages: [
          { role: 'system', content: prompt.systemInstruction },
          { role: 'user', content: prompt.userMessage },
        ],
        temperature: 0.7,
        max_tokens: 300,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(env.ollama.keepAlive !== '5m' && { keep_alive: env.ollama.keepAlive } as any),
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      const tokensUsed = response.usage?.total_tokens || 0;
      const cost = calculateCost(
        AI_MODELS.GENERATION,
        response.usage?.prompt_tokens || 0,
        response.usage?.completion_tokens || 0
      );

      logger.info('AI: model response received', {
        model: AI_MODELS.GENERATION,
        tokensUsed,
        latencyMs: Date.now() - callStart,
        responseLength: content.trim().length,
      });

      return {
        generatedText: content.trim(),
        cost,
        tokensUsed,
      };
    } catch (error: any) {
      const latencyMs = Date.now() - callStart;
      const isTimeout = error?.message?.toLowerCase().includes('timeout') || error?.message?.toLowerCase().includes('timed out') || error?.code === 'ETIMEDOUT';
      logger.error('AI: call failed', {
        model: AI_MODELS.GENERATION,
        latencyMs,
        error: error.message,
        isTimeout,
      });
      throw new AppError(
        500,
        'AI_ERROR',
        isTimeout
          ? `Ollama timed out after ${Math.round(latencyMs / 1000)}s — run \`ollama serve\` and ensure the model is pulled, or set OLLAMA_TIMEOUT_MS higher`
          : `AI call failed: ${error.message}`
      );
    }
  }

  /**
   * Estimates how well the generated reply matches the business style.
   *
   * Heuristics (explainable & fast):
   * - Base score: 0.5
   * - Emoji usage: small boost when usage matches style preference
   * - Length: small boost when length fits preferred sentence length
   * - Signature phrases: larger boost (0.2) as this is a strong match
   *
   * These are intentionally simple to keep inference cheap and interpretable.
   * We clamp the returned score to [0, 1].
   *
   * @param text - Generated text from the AI model
   * @param style - Style profile (emoji usage, sentence length preference, signature phrases)
   */
  private calculateConfidence(text: string, style: any): number {
    // Simple heuristics for MVP
    let score = 0.5;

    // Check emoji usage
    const emojiCount = (text.match(/[\p{Emoji}]/gu) || []).length;
    if (style.emojiUsage === 'NONE' && emojiCount === 0) score += 0.1;
    if (style.emojiUsage === 'LIGHT' && emojiCount >= 1 && emojiCount <= 2) score += 0.1;
    if (style.emojiUsage === 'FREQUENT' && emojiCount >= 3) score += 0.1;

    // Check length
    const wordCount = text.split(/\s+/).length;
    if (style.sentenceLengthPref === 'SHORT' && wordCount < 30) score += 0.1;
    if (style.sentenceLengthPref === 'MEDIUM' && wordCount >= 30 && wordCount < 80) score += 0.1;
    if (style.sentenceLengthPref === 'LONG' && wordCount >= 80) score += 0.1;

    // Check signature phrases
    const containsSignature = style.signaturePhrases.some((phrase: string) =>
      text.toLowerCase().includes(phrase.toLowerCase())
    );
    if (containsSignature) score += 0.2;

    return Math.min(score, 1.0);
  }

  private async getEphemeralContext(ctx: TenantContext, contactId: string) {
    const key = `ctx:${ctx.tenantId}:${contactId}`;
    const cached = await redisClient.get(key);

    if (cached) {
      return JSON.parse(cached);
    }

    return { recentTurns: [] };
  }

  private async updateEphemeralContext(
    ctx: TenantContext,
    contactId: string,
    turn: { direction: string; summary: string; timestamp: Date }
  ) {
    const key = `ctx:${ctx.tenantId}:${contactId}`;
    const maxTurns = parseInt(process.env.MAX_EPHEMERAL_TURNS || '3');
    const ttl = parseInt(process.env.EPHEMERAL_CONTEXT_TTL || '1800');

    const context = await this.getEphemeralContext(ctx, contactId);
    context.recentTurns = [turn, ...(context.recentTurns || [])].slice(0, maxTurns);

    await redisClient.setEx(key, ttl, JSON.stringify(context));
  }

  /**
   * List all generated replies for the tenant, joined with contact info.
   * Confidence is scaled to 0-100 for the frontend.
   */
  async listReplies(ctx: TenantContext) {
    const replies = await prisma.generatedReply.findMany({
      where: { contact: { tenantId: ctx.tenantId } },
      include: { contact: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return replies.map((r) => ({
      id: r.id,
      generatedText: r.generatedText,
      confidence: Math.round(r.confidence * 100),
      status: r.status,
      contactName: r.contact.name || r.contact.externalId,
      createdAt: r.createdAt,
      sendError: r.sendError ?? undefined,
    }));
  }

  /**
   * Approve a generated reply.
   * Marks the reply status as APPROVED, sends to WhatsApp (awaited so errors surface),
   * and records a learning event / updates ephemeral context fire-and-forget.
   */
  async approveReply(ctx: TenantContext, replyId: string) {
    const reply = await prisma.generatedReply.findUnique({
      where: { id: replyId },
      include: { contact: true },
    });

    if (!reply) {
      throw new AppError(404, 'REPLY_NOT_FOUND', 'Reply not found');
    }

    // Verify tenant ownership via contact
    if (reply.contact.tenantId !== ctx.tenantId) {
      throw new AppError(403, 'FORBIDDEN', 'Not authorized');
    }

    const updated = await prisma.generatedReply.update({
      where: { id: replyId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
      },
    });

    logger.info('Reply approved', { tenantId: ctx.tenantId, replyId });

    // Send to WhatsApp — awaited so the error reaches the HTTP response
    let whatsappSent = false;
    let whatsappError: string | null = null;

    if (reply.contact.platform === 'WHATSAPP') {
      const whatsappService = new WhatsAppService();
      // Use editedText when the owner corrected the reply before approving,
      // otherwise fall back to the original AI-generated text.
      const textToSend = reply.editedText ?? reply.generatedText;
      logger.info('Sending reply to WhatsApp', { replyId, to: reply.contact.externalId });
      try {
        await whatsappService.sendMessage(ctx, reply.contact.externalId, textToSend);
        await prisma.generatedReply.update({
          where: { id: replyId },
          data: { status: 'SENT', sentAt: new Date() },
        });
        whatsappSent = true;
        logger.info('Reply sent to WhatsApp', { replyId, to: reply.contact.externalId });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const cause = (err as any)?.cause;
        whatsappError = msg;
        logger.error('Failed to send reply to WhatsApp', {
          replyId,
          error: msg,
          ...(cause ? { cause: cause instanceof Error ? cause.message : String(cause) } : {}),
        });
        // Persist the error so the dashboard can surface it without digging through logs
        prisma.generatedReply.update({
          where: { id: replyId },
          data: { sendError: msg },
        }).catch((dbErr: unknown) => {
          logger.warn('Could not persist sendError to DB', { error: (dbErr as Error)?.message });
        });
      }
    }

    // Non-critical: fire-and-forget
    this.styleService.recordLearningEvent(ctx, {
      eventType: 'APPROVAL',
      replyId,
      originalReply: reply.generatedText,
    }).catch((err: unknown) => {
      logger.warn('Learning event failed (non-critical)', { error: (err as Error)?.message });
    });

    this.updateEphemeralContext(ctx, reply.contactId, {
      direction: 'outbound',
      summary: (reply.editedText ?? reply.generatedText).substring(0, 100),
      timestamp: new Date(),
    }).catch((err: unknown) => {
      logger.warn('Ephemeral context update failed (non-critical)', { error: (err as Error)?.message });
    });

    return { ...updated, whatsappSent, whatsappError };
  }

  /**
   * Edit an existing generated reply.
   * Applies the provided edited text, marks status as EDITED, and records a learning event.
   */
  async editReply(ctx: TenantContext, input: EditReplyInput) {
    const reply = await prisma.generatedReply.findUnique({
      where: { id: input.replyId },
      include: { contact: true },
    });

    if (!reply) {
      throw new AppError(404, 'REPLY_NOT_FOUND', 'Reply not found');
    }

    if (reply.contact.tenantId !== ctx.tenantId) {
      throw new AppError(403, 'FORBIDDEN', 'Not authorized');
    }

    const updated = await prisma.generatedReply.update({
      where: { id: input.replyId },
      data: {
        editedText: input.editedText,
        status: 'EDITED',
        approvedAt: new Date(),
      },
    });

    // Record style learning event
    await this.styleService.recordLearningEvent(ctx, {
      eventType: 'EDIT',
      replyId: input.replyId,
      originalReply: reply.generatedText,
      editedReply: input.editedText,
    });

    logger.info('Reply edited', {
      tenantId: ctx.tenantId,
      replyId: input.replyId,
    });

    return updated;
  }

  /**
   * Reject a generated reply.
   * Marks the reply as REJECTED and logs the event for auditing.
   */
  async rejectReply(ctx: TenantContext, replyId: string) {
    const reply = await prisma.generatedReply.findUnique({
      where: { id: replyId },
      include: { contact: true },
    });

    if (!reply) {
      throw new AppError(404, 'REPLY_NOT_FOUND', 'Reply not found');
    }

    if (reply.contact.tenantId !== ctx.tenantId) {
      throw new AppError(403, 'FORBIDDEN', 'Not authorized');
    }

    const updated = await prisma.generatedReply.update({
      where: { id: replyId },
      data: {
        status: 'REJECTED',
      },
    });

    // Record style learning event
    await this.styleService.recordLearningEvent(ctx, {
      eventType: 'REJECTION',
      replyId,
      originalReply: reply.generatedText,
    });

    logger.info('Reply rejected', {
      tenantId: ctx.tenantId,
      replyId,
    });

    return updated;
  }
}
