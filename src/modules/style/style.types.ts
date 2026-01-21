import { z } from 'zod';

export const OnboardingQuizSchema = z.object({
  tone: z.enum(['FRIENDLY', 'PROFESSIONAL', 'PLAYFUL', 'PREMIUM']),
  emojiUsage: z.enum(['NONE', 'LIGHT', 'FREQUENT']),
  humorLevel: z.enum(['OFF', 'PLAYFUL', 'SARCASTIC']),
  formality: z.number().int().min(1).max(10),
  sentenceLengthPref: z.enum(['SHORT', 'MEDIUM', 'LONG']),
  ctaStyle: z.enum(['DIRECT', 'SOFT', 'CONSULTATIVE']),
  signaturePhrases: z.array(z.string()).max(5),
  conversationGoal: z.string(),
});

export const RecordLearningEventSchema = z.object({
  eventType: z.enum(['APPROVAL', 'EDIT', 'REJECTION']),
  replyId: z.string().uuid(),
  originalReply: z.string().optional(),
  editedReply: z.string().optional(),
});

export type OnboardingQuizInput = z.infer<typeof OnboardingQuizSchema>;
export type RecordLearningEventInput = z.infer<typeof RecordLearningEventSchema>;
