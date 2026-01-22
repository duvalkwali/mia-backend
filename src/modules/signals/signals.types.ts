import { z } from 'zod';

export const ExtractSignalsSchema = z.object({
  contactExternalId: z.string(),
  platform: z.enum(['WHATSAPP', 'INSTAGRAM']),
  messageText: z.string(), // EPHEMERAL - only for extraction
  contactName: z.string().optional(),
});

export type ExtractSignalsInput = z.infer<typeof ExtractSignalsSchema>;

export interface SignalExtractionResult {
  contactId: string;
  signals: {
    intent: string;
    sentiment: string;
    urgency: string;
    funnelStage: string;
    keyTopics: string[];
    questionsAsked: string[];
    objectionsRaised: string[];
  };
  extractionMethod: 'rules' | 'ai' | 'hybrid';
  cost: number;
}
