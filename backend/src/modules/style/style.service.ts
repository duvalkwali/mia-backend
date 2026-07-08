import { createHash } from 'crypto';
import prisma from '@/config/database';
import { AppError } from '../../middleware/errorHandler';
import { TenantContext } from '../../shared/types/common.types';
import {
  OnboardingQuizInput,
  RecordLearningEventInput,
  PatchLearnedRuleInput,
  VocabularyPreferences,
} from './style.types';
import { TemplateCache } from '../ai-reply/templateCache';
import ollamaClient, { AI_MODELS } from '@/config/openai';
import logger from '../../config/logger';

export class StyleService {
  private templateCache = new TemplateCache();

  // ─── Profile CRUD ───────────────────────────────────────────────────────────

  async createStyleProfile(ctx: TenantContext, input: OnboardingQuizInput) {
    const existing = await prisma.styleProfile.findUnique({
      where: { tenantId: ctx.tenantId },
    });
    if (existing) {
      throw new AppError(409, 'PROFILE_EXISTS', 'Style profile already exists');
    }

    const vocabPrefs = this.buildVocabPrefs(input.vocabularyPhrases, input.avoidPhrases);

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
        vocabularyPreferences: vocabPrefs ?? undefined,
      },
    });

    logger.info('Style profile created', { tenantId: ctx.tenantId, profileId: profile.id });
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

  /**
   * Partial upsert from the frontend wizard (PUT /style).
   * Fields left undefined are not written, so an update never resets
   * previously saved values to defaults. Defaults only apply on first create.
   */
  async upsertStyleProfile(
    ctx: TenantContext,
    input: {
      tone?: 'FRIENDLY' | 'PROFESSIONAL' | 'PLAYFUL' | 'PREMIUM';
      emojiUsage?: 'NONE' | 'LIGHT' | 'FREQUENT';
      formality?: number;
      signaturePhrases?: string[];
      conversationGoal?: string;
      vocabularyPhrases?: Array<{ id: string; text: string; context?: string; avoidIn?: string }>;
      avoidPhrases?: string[];
    }
  ) {
    const vocabPrefs = this.buildVocabPrefs(input.vocabularyPhrases, input.avoidPhrases);
    const sharedData = {
      ...(input.tone !== undefined && { tone: input.tone }),
      ...(input.emojiUsage !== undefined && { emojiUsage: input.emojiUsage }),
      ...(input.formality !== undefined && { formality: input.formality }),
      ...(input.signaturePhrases !== undefined && { signaturePhrases: input.signaturePhrases }),
      ...(input.conversationGoal !== undefined && { conversationGoal: input.conversationGoal }),
      ...(vocabPrefs !== null && { vocabularyPreferences: vocabPrefs }),
    };

    const existing = await prisma.styleProfile.findUnique({
      where: { tenantId: ctx.tenantId },
    });

    const result = existing
      ? await prisma.styleProfile.update({ where: { tenantId: ctx.tenantId }, data: sharedData })
      : await prisma.styleProfile.create({
          data: {
            tenantId: ctx.tenantId,
            tone: input.tone ?? 'FRIENDLY',
            emojiUsage: input.emojiUsage ?? 'NONE',
            formality: input.formality ?? 3,
            signaturePhrases: input.signaturePhrases ?? [],
            conversationGoal: input.conversationGoal ?? 'build_rapport',
            ...(vocabPrefs !== null && { vocabularyPreferences: vocabPrefs }),
            humorLevel: 'OFF',
            sentenceLengthPref: 'MEDIUM',
            ctaStyle: 'SOFT',
          },
        });

    await this.templateCache.clearTenantCache(ctx.tenantId);
    return result;
  }

  // ─── Learning events ─────────────────────────────────────────────────────────

  async recordLearningEvent(ctx: TenantContext, input: RecordLearningEventInput) {
    const profile = await this.getStyleProfile(ctx);

    const extractedPatterns =
      input.eventType === 'EDIT' && input.originalReply && input.editedReply
        ? this.extractPatternsFromEdit(input.originalReply, input.editedReply)
        : undefined;

    const event = await prisma.styleLearningEvent.create({
      data: {
        styleProfileId: profile.id,
        eventType: input.eventType,
        originalReply: input.originalReply,
        editedReply: input.editedReply,
        ...(extractedPatterns !== undefined && { extractedPatterns }),
      },
    });

    const updateData: Record<string, unknown> = {};
    if (input.eventType === 'APPROVAL') updateData.approvalCount = { increment: 1 };
    if (input.eventType === 'EDIT')     updateData.editCount     = { increment: 1 };
    if (input.eventType === 'REJECTION') updateData.rejectionCount = { increment: 1 };
    await prisma.styleProfile.update({ where: { id: profile.id }, data: updateData });

    // Fire-and-forget: ask Ollama to derive a style rule from this edit.
    // Never blocks the HTTP response — if Ollama is busy it simply queues up.
    if (input.eventType === 'EDIT' && input.originalReply && input.editedReply) {
      this.deriveRuleFromEdit(profile.id, ctx.tenantId, input.originalReply, input.editedReply)
        .catch(err => logger.warn('Rule derivation failed (non-fatal)', { err }));
    }

    logger.info('Learning event recorded', {
      tenantId: ctx.tenantId,
      eventType: input.eventType,
      profileId: profile.id,
    });

    return event;
  }

  // ─── Learned rules ────────────────────────────────────────────────────────────

  async getLearnedRules(ctx: TenantContext) {
    const profile = await this.getStyleProfile(ctx);
    return prisma.learnedStyleRule.findMany({
      where: { styleProfileId: profile.id },
      orderBy: [{ exampleCount: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async patchLearnedRule(ctx: TenantContext, ruleId: string, input: PatchLearnedRuleInput) {
    const profile = await this.getStyleProfile(ctx);
    const rule = await prisma.learnedStyleRule.findFirst({
      where: { id: ruleId, styleProfileId: profile.id },
    });
    if (!rule) throw new AppError(404, 'RULE_NOT_FOUND', 'Learned rule not found');

    const updated = await prisma.learnedStyleRule.update({
      where: { id: ruleId },
      data: { active: input.active },
    });

    // Toggling a rule changes what gets injected into the prompt
    await this.templateCache.clearTenantCache(ctx.tenantId);
    return updated;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Builds the VocabularyPreferences JSON blob from raw inputs.
   * Returns null if neither field was provided (so we don't overwrite existing data
   * when the caller didn't touch vocabulary at all).
   */
  private buildVocabPrefs(
    phrases?: Array<{ id: string; text: string; context?: string; avoidIn?: string }>,
    avoid?: string[]
  ): VocabularyPreferences | null {
    if (phrases === undefined && avoid === undefined) return null;
    return { phrases: phrases ?? [], avoid: avoid ?? [] };
  }

  /**
   * Word-level diff between the original AI reply and the human edit.
   * Produces concrete vocabulary signals (added/removed words and n-gram phrases)
   * that the prompt builder can inject back into future replies.
   *
   * Pure string operations — runs in < 1ms, no external calls.
   */
  private extractPatternsFromEdit(original: string, edited: string) {
    const origWords  = this.tokenize(original);
    const editedWords = this.tokenize(edited);

    const origSet   = new Set(origWords);
    const editedSet = new Set(editedWords);

    const addedWords   = [...new Set(editedWords.filter(w => !origSet.has(w)))].slice(0, 20);
    const removedWords = [...new Set(origWords.filter(w => !editedSet.has(w)))].slice(0, 20);

    // 2-gram and 3-gram phrases for multi-word pattern detection
    const origBigrams    = new Set(this.ngrams(origWords, 2));
    const editedBigrams  = new Set(this.ngrams(editedWords, 2));
    const origTrigrams   = new Set(this.ngrams(origWords, 3));
    const editedTrigrams = new Set(this.ngrams(editedWords, 3));

    const addedPhrases = [
      ...Array.from(editedBigrams).filter(p => !origBigrams.has(p)),
      ...Array.from(editedTrigrams).filter(p => !origTrigrams.has(p)),
    ].slice(0, 10);

    const removedPhrases = [
      ...Array.from(origBigrams).filter(p => !editedBigrams.has(p)),
      ...Array.from(origTrigrams).filter(p => !editedTrigrams.has(p)),
    ].slice(0, 10);

    const origEmojis   = (original.match(/[\p{Emoji}]/gu) || []).length;
    const editedEmojis = (edited.match(/[\p{Emoji}]/gu) || []).length;

    const formalWords = ['please', 'kindly', 'would', 'could', 'appreciate'];
    const casualWords = ['hey', 'yeah', 'cool', 'awesome', 'totally'];
    const origFormal   = formalWords.filter(w => original.toLowerCase().includes(w)).length;
    const editedFormal = formalWords.filter(w => edited.toLowerCase().includes(w)).length;
    const origCasual   = casualWords.filter(w => original.toLowerCase().includes(w)).length;
    const editedCasual = casualWords.filter(w => edited.toLowerCase().includes(w)).length;

    let tone_shift: string | undefined;
    if (editedFormal > origFormal) tone_shift = 'more_formal';
    if (editedCasual > origCasual) tone_shift = 'more_casual';

    return {
      length_change:   edited.length - original.length,
      added_words:     addedWords,
      removed_words:   removedWords,
      added_phrases:   addedPhrases,
      removed_phrases: removedPhrases,
      emoji_change:    editedEmojis - origEmojis,
      tone_shift,
    };
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1);
  }

  private ngrams(words: string[], n: number): string[] {
    const result: string[] = [];
    for (let i = 0; i <= words.length - n; i++) {
      result.push(words.slice(i, i + n).join(' '));
    }
    return result;
  }

  /**
   * Asks Ollama to infer one concise style rule from a before/after edit pair.
   * Called fire-and-forget — never awaited on the request path.
   */
  private async deriveRuleFromEdit(
    styleProfileId: string,
    tenantId: string,
    original: string,
    edited: string
  ): Promise<void> {
    const response = await ollamaClient.chat.completions.create({
      model: AI_MODELS.EXTRACTION,
      messages: [
        {
          role: 'system',
          content: 'You are a writing style analyst. Be terse and precise.',
        },
        {
          role: 'user',
          content:
            `Original AI reply:\n"""${original}"""\n\n` +
            `Human edit:\n"""${edited}"""\n\n` +
            `In ONE sentence (max 15 words), state the single most important style rule the editor applied.\n` +
            `Reply with ONLY the rule sentence, nothing else.\n` +
            `Example: "Avoid formal closings — end with a direct next step instead."`,
        },
      ],
      max_tokens: 60,
      temperature: 0.2,
    });

    const ruleText = response.choices[0]?.message?.content?.trim();
    if (!ruleText || ruleText.length < 10) return;

    await this.upsertLearnedRule(styleProfileId, tenantId, ruleText);
  }

  /**
   * Insert a new learned rule or increment an existing one's confidence.
   * Deduplication is done by MD5 hash of the normalized rule text.
   * When exampleCount crosses a threshold (3 or 5), invalidate the template
   * cache so the rule gets injected into the next reply generation.
   */
  private async upsertLearnedRule(
    styleProfileId: string,
    tenantId: string,
    ruleText: string
  ): Promise<void> {
    const normalized = ruleText.toLowerCase().trim().replace(/\s+/g, ' ');
    const ruleHash   = createHash('md5').update(normalized).digest('hex');

    const getConfidence = (count: number) =>
      count >= 5 ? 0.85 : count >= 3 ? 0.6 : 0.3;

    const existing = await prisma.learnedStyleRule.findUnique({
      where: { styleProfileId_ruleHash: { styleProfileId, ruleHash } },
    });

    if (existing) {
      const newCount = existing.exampleCount + 1;
      await prisma.learnedStyleRule.update({
        where: { id: existing.id },
        data: { exampleCount: newCount, confidence: getConfidence(newCount) },
      });

      const crossedThreshold =
        (existing.exampleCount < 3 && newCount >= 3) ||
        (existing.exampleCount < 5 && newCount >= 5);

      if (crossedThreshold) {
        await this.templateCache.clearTenantCache(tenantId);
        logger.info('Learned rule promoted — template cache cleared', { ruleHash, newCount, tenantId });
      }
    } else {
      await prisma.learnedStyleRule.create({
        data: {
          styleProfileId,
          ruleType: 'tone',
          rule: ruleText,
          ruleHash,
          confidence: 0.3,
          exampleCount: 1,
        },
      });
    }

    logger.info('Learned rule upserted', { styleProfileId, ruleHash });
  }
}
