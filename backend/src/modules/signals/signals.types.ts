/**
 * Type definitions for the signals module.
 * Defines input schemas, interfaces, and types for signal extraction operations.
 */

import { z } from 'zod';

/**
 * Zod schema for validating signal extraction input.
 * Ensures required fields are present and properly typed.
 */
export const ExtractSignalsSchema = z.object({
  contactExternalId: z.string(), // External ID from messaging platform
  platform: z.enum(['WHATSAPP', 'INSTAGRAM']), // Supported platforms
  messageText: z.string(), // EPHEMERAL - only for extraction, not stored
  contactName: z.string().optional(), // Optional contact name
});

/**
 * Type inferred from the ExtractSignalsSchema.
 */
export type ExtractSignalsInput = z.infer<typeof ExtractSignalsSchema>;

/**
 * Result interface for signal extraction operations.
 * Contains the extracted signals, contact ID, extraction method, and cost.
 */
export interface SignalExtractionResult {
  contactId: string; // Internal contact ID
  signals: {
    intent: string; // Customer intent (PRICING, BOOKING, etc.)
    sentiment: string; // Sentiment analysis (POSITIVE, NEGATIVE, etc.)
    urgency: string; // Urgency level (LOW, MEDIUM, HIGH)
    funnelStage: string; // Sales funnel stage (LEAD, INTERESTED, etc.)
    keyTopics: string[]; // Main topics discussed
    questionsAsked: string[]; // Categories of questions asked
    objectionsRaised: string[]; // Types of objections raised
  };
  extractionMethod: 'rules' | 'ai' | 'hybrid'; // Method used for extraction
  cost: number; // Cost in USD for AI extraction (0 for rules)
}
