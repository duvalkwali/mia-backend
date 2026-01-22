import openai, { AI_MODELS, calculateCost } from '../../../config/openai';
import logger from '../../../config/logger';
import { ExtractedSignals } from './rulesExtractor';

/**
 * COST OPTIMIZATION: Use GPT-4o-mini for signal extraction
 * 
 * Only called when rules-based extraction has low confidence.
 * GPT-4o-mini is 90% cheaper than GPT-4o.
 */
export class AIExtractor {
  async extract(messageText: string): Promise<{ signals: ExtractedSignals; cost: number }> {
    const prompt = `You are a signal extraction system. Analyze the following customer message and extract structured signals.

Customer Message: "${messageText}"

Extract the following in JSON format:
{
  "intent": "PRICING | AVAILABILITY | OBJECTION | BOOKING | QUESTION | GREETING | COMPLAINT | FOLLOWUP",
  "sentiment": "POSITIVE | NEUTRAL | HESITANT | NEGATIVE",
  "urgency": "LOW | MEDIUM | HIGH",
  "funnelStage": "LEAD | INTERESTED | NEGOTIATING | CLOSED | CHURNED",
  "keyTopics": ["topic1", "topic2"],
  "questionsAsked": ["Category of question 1", "Category of question 2"],
  "objectionsRaised": ["too_expensive", "timing_concerns", "competitor_comparison"]
}

Rules:
- keyTopics: Extract 1-3 main topics discussed
- questionsAsked: Categorize questions, NOT verbatim text
- objectionsRaised: Use categories, not full text
- Be concise and structured

Return ONLY valid JSON, no other text.`;

    try {
      const response = await openai.chat.completions.create({
        model: AI_MODELS.EXTRACTION, // gpt-4o-mini
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        response_format: { type: 'json_object' },
        max_tokens: 300,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      const extracted = JSON.parse(content);

      // Calculate cost
      const tokensUsed = response.usage?.total_tokens || 0;
      const cost = calculateCost(
        AI_MODELS.EXTRACTION,
        response.usage?.prompt_tokens || 0,
        response.usage?.completion_tokens || 0
      );

      logger.info('AI extraction completed', {
        model: AI_MODELS.EXTRACTION,
        tokensUsed,
        costUsd: cost,
      });

      return {
        signals: {
          intent: extracted.intent || 'QUESTION',
          sentiment: extracted.sentiment || 'NEUTRAL',
          urgency: extracted.urgency || 'MEDIUM',
          funnelStage: extracted.funnelStage || 'LEAD',
          keyTopics: Array.isArray(extracted.keyTopics) ? extracted.keyTopics : [],
          questionsAsked: Array.isArray(extracted.questionsAsked) ? extracted.questionsAsked : [],
          objectionsRaised: Array.isArray(extracted.objectionsRaised) ? extracted.objectionsRaised : [],
          confidence: 0.9, // AI extractions are high confidence
        },
        cost,
      };
    } catch (error: any) {
      logger.error('AI extraction failed', { error: error.message });
      throw error;
    }
  }
}
