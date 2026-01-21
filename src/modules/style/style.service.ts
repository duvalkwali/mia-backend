import prisma from '@/config/database';
import { AppError } from '../../middleware/errorHandler';
import { TenantContext } from '../../shared/types/common.types';
import { OnboardingQuizInput, RecordLearningEventInput } from './style.types';
import logger from '../../config/logger';

export class StyleService {
  async createStyleProfile(ctx: TenantContext, input: OnboardingQuizInput) {
    // Check if profile already exists
    const existing = await prisma.styleProfile.findUnique({
      where: { tenantId: ctx.tenantId },
    });

    if (existing) {
      throw new AppError(409, 'PROFILE_EXISTS', 'Style profile already exists');
    }

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

  async getStyleProfile(ctx: TenantContext) {
    const profile = await prisma.styleProfile.findUnique({
      where: { tenantId: ctx.tenantId },
    });

    if (!profile) {
      throw new AppError(404, 'PROFILE_NOT_FOUND', 'Style profile not found. Complete onboarding first.');
    }

    return profile;
  }

  async recordLearningEvent(ctx: TenantContext, input: RecordLearningEventInput) {
    const profile = await this.getStyleProfile(ctx);

    // Extract patterns from edit if applicable
    let extractedPatterns = null;
    if (input.eventType === 'EDIT' && input.originalReply && input.editedReply) {
      extractedPatterns = this.extractPatternsFromEdit(
        input.originalReply,
        input.editedReply
      );
    }

    // Create learning event
    const event = await prisma.styleLearningEvent.create({
      data: {
        styleProfileId: profile.id,
        eventType: input.eventType,
        originalReply: input.originalReply,
        editedReply: input.editedReply,
        extractedPatterns,
      },
    });

    // Update profile counts
    const updateData: any = {};
    if (input.eventType === 'APPROVAL') updateData.approvalCount = { increment: 1 };
    if (input.eventType === 'EDIT') updateData.editCount = { increment: 1 };
    if (input.eventType === 'REJECTION') updateData.rejectionCount = { increment: 1 };

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

  private extractPatternsFromEdit(original: string, edited: string) {
    // Simple pattern extraction for MVP
    // In V1, this can be enhanced with NLP
    
    const patterns: any = {
      length_change: edited.length - original.length,
      added_phrases: [],
      removed_phrases: [],
    };

    // Detect emoji changes
    const originalEmojis = (original.match(/[\p{Emoji}]/gu) || []).length;
    const editedEmojis = (edited.match(/[\p{Emoji}]/gu) || []).length;
    patterns.emoji_change = editedEmojis - originalEmojis;

    // Detect formality shift (simple heuristic)
    const formalWords = ['please', 'kindly', 'would', 'could', 'appreciate'];
    const casualWords = ['hey', 'yeah', 'cool', 'awesome', 'totally'];
    
    const originalFormal = formalWords.filter(w => original.toLowerCase().includes(w)).length;
    const editedFormal = formalWords.filter(w => edited.toLowerCase().includes(w)).length;
    const originalCasual = casualWords.filter(w => original.toLowerCase().includes(w)).length;
    const editedCasual = casualWords.filter(w => edited.toLowerCase().includes(w)).length;
    
    if (editedFormal > originalFormal) patterns.tone_shift = 'more_formal';
    if (editedCasual > originalCasual) patterns.tone_shift = 'more_casual';

    return patterns;
  }
}
