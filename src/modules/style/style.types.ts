import { z } from 'zod';

/**
 * This schema defines the onboarding quiz
 * that captures how the business wants the AI to sound.
 *
 * Zod ensures the data is valid BEFORE it reaches the database or AI.
 */
export const OnboardingQuizSchema = z.object({
  // Overall tone of AI replies
  tone: z.enum(['FRIENDLY', 'PROFESSIONAL', 'PLAYFUL', 'PREMIUM']),

  // How often emojis should be used
  emojiUsage: z.enum(['NONE', 'LIGHT', 'FREQUENT']),

  // Humor preference
  humorLevel: z.enum(['OFF', 'PLAYFUL', 'SARCASTIC']),

  // Numerical formality level (1 = casual, 10 = very formal)
  formality: z.number().int().min(1).max(10),

  // Preferred sentence length
  sentenceLengthPref: z.enum(['SHORT', 'MEDIUM', 'LONG']),

  // Call-to-action style
  ctaStyle: z.enum(['DIRECT', 'SOFT', 'CONSULTATIVE']),

  // Reusable phrases the business often uses
  signaturePhrases: z.array(z.string()).max(5),

  // Main objective of conversations (sales, support, trust, etc.)
  conversationGoal: z.string(),
});

/**
 * Schema used when the user interacts with AI replies
 * (approving, editing, or rejecting them).
 * This is how the system LEARNS over time.
 */
export const RecordLearningEventSchema = z.object({
  eventType: z.enum(['APPROVAL', 'EDIT', 'REJECTION']),

  // ID of the AI reply involved
  replyId: z.string().uuid(),

  // Original AI reply (optional)
  originalReply: z.string().optional(),

  // Edited version by the human (optional)
  editedReply: z.string().optional(),
});

// TypeScript types inferred automatically from Zod schemas
export type OnboardingQuizInput = z.infer<typeof OnboardingQuizSchema>;
export type RecordLearningEventInput = z.infer<typeof RecordLearningEventSchema>;
