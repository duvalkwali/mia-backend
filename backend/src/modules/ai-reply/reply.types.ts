/**
 * Types and validation schemas for AI reply module
 * - Validation uses Zod for runtime safety
 * - ComposedPrompt describes the system + user message pair sent to AI
 */
import { z } from 'zod';

/**
 * Validation schema for the "generate reply" API endpoint.
 * - contactId: UUID of the contact to generate a reply for
 * - incomingMessage: Ephemeral text used only for extraction; not persisted
 */
export const GenerateReplySchema = z.object({
  contactId: z.string().uuid(),
  incomingMessage: z.string(), // EPHEMERAL - used for signal extraction only
});

export const ApproveReplySchema = z.object({
  replyId: z.string().uuid(),
});

export const EditReplySchema = z.object({
  replyId: z.string().uuid(),
  editedText: z.string(),
});

export type GenerateReplyInput = z.infer<typeof GenerateReplySchema>;
export type ApproveReplyInput = z.infer<typeof ApproveReplySchema>;
export type EditReplyInput = z.infer<typeof EditReplySchema>;

/**
 * Pair of strings sent to the AI model: a cached system instruction and
 * a dynamic user message that contains the current contact signals.
 */
export interface ComposedPrompt {
  systemInstruction: string;
  userMessage: string;
}

/**
 * Data returned to clients after generating a reply.
 */
export interface GeneratedReplyData {
  replyId: string;
  generatedText: string;
  confidence: number;
  contactId: string;
  status: string;
  cost: number;
}
