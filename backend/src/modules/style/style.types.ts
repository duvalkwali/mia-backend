import { z } from 'zod';

/**
 * A single vocabulary phrase the owner uses, with optional context
 * about when to use it and when to avoid it.
 */
export const VocabPhraseSchema = z.object({
  id: z.string().uuid(),
  text: z.string().min(1).max(120),
  context: z.string().max(200).optional(),  // "when confirming casually with a warm customer"
  avoidIn: z.string().max(200).optional(),  // "first contact with new customers"
});

/**
 * Onboarding quiz schema — defines how the AI should sound.
 * Called once during initial setup (POST /style/onboard).
 */
export const OnboardingQuizSchema = z.object({
  tone: z.enum(['FRIENDLY', 'PROFESSIONAL', 'PLAYFUL', 'PREMIUM']),
  emojiUsage: z.enum(['NONE', 'LIGHT', 'FREQUENT']),
  humorLevel: z.enum(['OFF', 'PLAYFUL', 'SARCASTIC']),
  formality: z.number().int().min(1).max(5), // 1–5 scale, matching the wizard
  sentenceLengthPref: z.enum(['SHORT', 'MEDIUM', 'LONG']),
  ctaStyle: z.enum(['DIRECT', 'SOFT', 'CONSULTATIVE']),
  signaturePhrases: z.array(z.string().max(120)).max(5),
  conversationGoal: z.string().max(300),

  // Phase 1 setup: owner's personal vocabulary
  vocabularyPhrases: z.array(VocabPhraseSchema).max(20).optional(),
  avoidPhrases: z.array(z.string().max(80)).max(30).optional(),
});

/**
 * Schema for the frontend wizard (PUT /style).
 * Accepts the frontend's field names; the controller maps them to DB enums.
 *
 * Every field is optional and absent/empty fields leave the stored value
 * untouched. Legacy values (FORMAL, CASUAL, LOW, MODERATE, HIGH) are still
 * accepted for backward compatibility and mapped in the controller.
 */
export const UpdateStyleProfileSchema = z.object({
  tone: z
    .enum(['FRIENDLY', 'PROFESSIONAL', 'PLAYFUL', 'PREMIUM', 'FORMAL', 'CASUAL'])
    .or(z.literal(''))
    .optional(),
  emojiUsage: z
    .enum(['NONE', 'LIGHT', 'FREQUENT', 'LOW', 'MODERATE', 'HIGH'])
    .or(z.literal(''))
    .optional(),
  formality: z.coerce.number().int().min(1).max(5).optional(), // 1–5 scale
  signaturePhrases: z.array(z.string()).optional(),
  targetAudience: z.string().optional(),

  // Phase 1 setup: owner's personal vocabulary (same shape as onboarding)
  vocabularyPhrases: z.array(VocabPhraseSchema).max(20).optional(),
  avoidPhrases: z.array(z.string().max(80)).max(30).optional(),
});

/**
 * Schema for recording user feedback on AI replies.
 * This is how the system learns the owner's style over time.
 */
export const RecordLearningEventSchema = z.object({
  eventType: z.enum(['APPROVAL', 'EDIT', 'REJECTION']),
  replyId: z.string().uuid(),
  originalReply: z.string().optional(),
  editedReply: z.string().optional(),
});

/**
 * Schema for toggling a learned style rule on or off.
 */
export const PatchLearnedRuleSchema = z.object({
  active: z.boolean(),
});

export type VocabPhrase = z.infer<typeof VocabPhraseSchema>;
export type VocabularyPreferences = {
  phrases: VocabPhrase[];
  avoid: string[];
};
export type OnboardingQuizInput = z.infer<typeof OnboardingQuizSchema>;
export type UpdateStyleProfileInput = z.infer<typeof UpdateStyleProfileSchema>;
export type RecordLearningEventInput = z.infer<typeof RecordLearningEventSchema>;
export type PatchLearnedRuleInput = z.infer<typeof PatchLearnedRuleSchema>;
