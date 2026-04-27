import prisma from '@/config/database';
import { AppError } from '../../middleware/errorHandler';
import { TenantContext } from '../../shared/types/common.types';
import {
  OnboardingQuizInput,
  RecordLearningEventInput,
} from './style.types';
import { TemplateCache } from '../ai-reply/templateCache';
import logger from '../../config/logger';

/**
 * Service layer for style-related business logic.
 * Handles persistence and learning logic.
 */
export class StyleService {
  private templateCache = new TemplateCache();

  /**
   * Create a new style profile during onboarding.
   * Each tenant can have ONLY ONE style profile.
   */
  async createStyleProfile(ctx: TenantContext, input: OnboardingQuizInput) {
    // Check if a profile already exists for this tenant
    const existing = await prisma.styleProfile.findUnique({
      where: { tenantId: ctx.tenantId },
    });

    if (existing) {
      throw new AppError(
        409,
        'PROFILE_EXISTS',
        'Style profile already exists'
      );
    }

    // Create style profile in database
    const profile = await prisma.styleProfile.create({
      data: {
        tenantId: ctx.tenantId,
        tone: input.tone,
        emojiUsage: input.emojiUsage,
        humorLevel: input.humorLevel,
        formality: input.formality,
        sentenceLengthPref: input.sentenceLengthPref,
        ctaStyle: input.ctaStyle,
        signaturePhrases: input.signaturePhrases,
        conversationGoal: input.conversationGoal,
      },
    });

    logger.info('Style profile created', {
      tenantId: ctx.tenantId,
      profileId: profile.id,
    });

    return profile;
  }

  /**
   * Fetch the style profile for the current tenant.
   */
  async getStyleProfile(ctx: TenantContext) {
    const profile = await prisma.styleProfile.findUnique({
      where: { tenantId: ctx.tenantId },
    });

    if (!profile) {
      throw new AppError(
        404,
        'PROFILE_NOT_FOUND',
        'Style profile not found. Complete onboarding first.'
      );
    }

    return profile;
  }

  /**
   * Upsert style profile from the frontend wizard (PUT /style).
   * Creates with sensible defaults for required fields not in the frontend form.
   */
  async upsertStyleProfile(ctx: TenantContext, input: {
    tone: 'FRIENDLY' | 'PROFESSIONAL' | 'PLAYFUL' | 'PREMIUM';
    emojiUsage: 'NONE' | 'LIGHT' | 'FREQUENT';
    formality: number;
    signaturePhrases: string[];
    conversationGoal: string;
  }) {
    const existing = await prisma.styleProfile.findUnique({
      where: { tenantId: ctx.tenantId },
    });

    let result;
    if (existing) {
      result = await prisma.styleProfile.update({
        where: { tenantId: ctx.tenantId },
        data: {
          tone: input.tone,
          emojiUsage: input.emojiUsage,
          formality: input.formality,
          signaturePhrases: input.signaturePhrases,
          conversationGoal: input.conversationGoal,
        },
      });
    } else {
      result = await prisma.styleProfile.create({
        data: {
          tenantId: ctx.tenantId,
          tone: input.tone,
          emojiUsage: input.emojiUsage,
          formality: input.formality,
          signaturePhrases: input.signaturePhrases,
          conversationGoal: input.conversationGoal,
          humorLevel: 'OFF',
          sentenceLengthPref: 'MEDIUM',
          ctaStyle: 'SOFT',
        },
      });
    }

    // Invalidate cached prompt template so next reply uses the new style
    await this.templateCache.clearTenantCache(ctx.tenantId);

    return result;
  }

  /**
   * Record a learning event when the user
   * approves, edits, or rejects an AI reply.
   */
  async recordLearningEvent(
    ctx: TenantContext,
    input: RecordLearningEventInput
  ) {
    // Ensure style profile exists
    const profile = await this.getStyleProfile(ctx);

    // Extract patterns ONLY if the user edited the reply
    let extractedPatterns = null;
    if (
      input.eventType === 'EDIT' &&
      input.originalReply &&
      input.editedReply
    ) {
      extractedPatterns = this.extractPatternsFromEdit(
        input.originalReply,
        input.editedReply
      );
    }

    // Store learning event
    const event = await prisma.styleLearningEvent.create({
      data: {
        styleProfileId: profile.id,
        eventType: input.eventType,
        originalReply: input.originalReply,
        editedReply: input.editedReply,
        extractedPatterns,
      },
    });

    // Update counters on style profile
    const updateData: any = {};
    if (input.eventType === 'APPROVAL')
      updateData.approvalCount = { increment: 1 };
    if (input.eventType === 'EDIT')
      updateData.editCount = { increment: 1 };
    if (input.eventType === 'REJECTION')
      updateData.rejectionCount = { increment: 1 };

    await prisma.styleProfile.update({
      where: { id: profile.id },
      data: updateData,
    });

    logger.info('Learning event recorded', {
      tenantId: ctx.tenantId,
      eventType: input.eventType,
      profileId: profile.id,
    });

    return event;
  }

  /**
   * Extract simple behavioral patterns from edits.
   * This is intentionally lightweight for MVP.
   */
  private extractPatternsFromEdit(original: string, edited: string) {
    const patterns: any = {
      length_change: edited.length - original.length,
      added_phrases: [],
      removed_phrases: [],
    };

    // Emoji usage difference
    const originalEmojis =
      (original.match(/[\p{Emoji}]/gu) || []).length;
    const editedEmojis =
      (edited.match(/[\p{Emoji}]/gu) || []).length;
    patterns.emoji_change = editedEmojis - originalEmojis;

    // Simple tone heuristics
    const formalWords = ['please', 'kindly', 'would', 'could', 'appreciate'];
    const casualWords = ['hey', 'yeah', 'cool', 'awesome', 'totally'];

    const originalFormal =
      formalWords.filter(w => original.toLowerCase().includes(w)).length;
    const editedFormal =
      formalWords.filter(w => edited.toLowerCase().includes(w)).length;

    const originalCasual =
      casualWords.filter(w => original.toLowerCase().includes(w)).length;
    const editedCasual =
      casualWords.filter(w => edited.toLowerCase().includes(w)).length;

    if (editedFormal > originalFormal)
      patterns.tone_shift = 'more_formal';
    if (editedCasual > originalCasual)
      patterns.tone_shift = 'more_casual';

    return patterns;
  }
}

