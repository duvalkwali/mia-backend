import { z } from 'zod';

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

export interface ComposedPrompt {
  systemInstruction: string;
  userMessage: string;
}

export interface GeneratedReplyData {
  replyId: string;
  generatedText: string;
  confidence: number;
  contactId: string;
  status: string;
  cost: number;
}
