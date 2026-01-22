import logger from '../../../config/logger';
export interface ExtractedSignals {
  intent: string;
  sentiment: string;
  urgency: string;
  funnelStage: string;
  keyTopics: string[];
  questionsAsked: string[];
  objectionsRaised: string[];
  confidence: number; // 0-1, how confident we are
}

/**
 * COST OPTIMIZATION: Rules-based signal extraction
 * 
 * This is FREE and handles 70-80% of common patterns.
 * Falls back to AI only when confidence is low.
 */
export class RulesExtractor {
  extract(messageText: string): ExtractedSignals {
    const lowerText = messageText.toLowerCase();
    const words = lowerText.split(/\s+/);

    // Intent detection
    const intent = this.detectIntent(lowerText);
    
    // Sentiment detection
    const sentiment = this.detectSentiment(lowerText);
    
    // Urgency detection
    const urgency = this.detectUrgency(lowerText);
    
    // Funnel stage inference
    const funnelStage = this.inferFunnelStage(lowerText, intent);
    
    // Extract topics
    const keyTopics = this.extractTopics(lowerText);
    
    // Detect questions
    const questionsAsked = this.extractQuestions(messageText);
    
    // Detect objections
    const objectionsRaised = this.detectObjections(lowerText);
    
    // Calculate confidence
    const confidence = this.calculateConfidence(
      intent,
      sentiment,
      urgency,
      keyTopics,
      questionsAsked
    );

    return {
      intent,
      sentiment,
      urgency,
      funnelStage,
      keyTopics,
      questionsAsked,
      objectionsRaised,
      confidence,
    };
  }

  private detectIntent(text: string): string {
    const patterns = {
      PRICING: ['price', 'cost', 'how much',  'expensive', 'cheap', 'afford', 'budget', 'rate', 'fee'],
      AVAILABILITY: ['available', 'when', 'schedule', 'time', 'date', 'free', 'busy', 'open'],
      BOOKING: ['book', 'reserve', 'appointment', 'schedule', 'confirm', 'slot'],
      OBJECTION: ['but', 'however', 'concern', 'worried', 'not sure', 'hesitant', 'problem'],
      GREETING: ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'],
      COMPLAINT: ['disappointed', 'unhappy', 'bad', 'terrible', 'awful', 'worst', 'refund'],
      THANKS: ['thank you', 'thanks', 'appreciate', 'grateful', 'much appreciated'],
      FOLLOWUP: ['following up', 'any update', 'heard back', 'status', 'checking in'],
    };

    let maxScore = 0;
    let detectedIntent = 'QUESTION'; // Default

    for (const [intent, keywords] of Object.entries(patterns)) {
      const score = keywords.filter(k => text.includes(k)).length;
      if (score > maxScore) {
        maxScore = score;
        detectedIntent = intent;
      }
    }

    return detectedIntent;
  }

  private detectSentiment(text: string): string {
    const positive = ['great', 'perfect', 'awesome', 'love', 'thank', 'excellent', 'amazing', 'wonderful'];
    const negative = ['bad', 'terrible', 'awful', 'hate', 'disappointed', 'poor', 'worst'];
    const hesitant = ['maybe', 'not sure', 'uncertain', 'thinking', 'considering', 'hmm'];

    const positiveScore = positive.filter(w => text.includes(w)).length;
    const negativeScore = negative.filter(w => text.includes(w)).length;
    const hesitantScore = hesitant.filter(w => text.includes(w)).length;

    if (positiveScore > negativeScore && positiveScore > hesitantScore) return 'POSITIVE';
    if (negativeScore > positiveScore) return 'NEGATIVE';
    if (hesitantScore > 0) return 'HESITANT';

    return 'NEUTRAL';
  }

  private detectUrgency(text: string): string {
    const highUrgency = ['urgent', 'asap', 'immediately', 'emergency', 'now', 'today', 'right away'];
    const mediumUrgency = ['soon', 'this week', 'quickly', 'fast'];

    if (highUrgency.some(w => text.includes(w))) return 'HIGH';
    if (mediumUrgency.some(w => text.includes(w))) return 'MEDIUM';

    return 'LOW';
  }

  private inferFunnelStage(text: string, intent: string): string {
    if (intent === 'GREETING') return 'LEAD';
    if (intent === 'PRICING' || intent === 'AVAILABILITY') return 'INTERESTED';
    if (intent === 'BOOKING') return 'NEGOTIATING';
    if (intent === 'OBJECTION') return 'NEGOTIATING';
    if (text.includes('confirm') || text.includes('yes')) return 'CLOSED';

    return 'LEAD';
  }

  private extractTopics(text: string): string[] {
    const topicKeywords = {
      pricing: ['price', 'cost', 'budget', 'expensive'],
      delivery: ['deliver', 'shipping', 'arrival', 'send'],
      quality: ['quality', 'good', 'best', 'standard'],
      timing: ['when', 'time', 'schedule', 'date'],
      features: ['feature', 'include', 'what do', 'options'],
    };

    const detected: string[] = [];

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(k => text.includes(k))) {
        detected.push(topic);
      }
    }

    return detected.slice(0, 3); // Max 3 topics
  }

  private extractQuestions(messageText: string): string[] {
    const questions: string[] = [];
    const sentences = messageText.split(/[.!?]+/).map(s => s.trim());

    for (const sentence of sentences) {
      if (sentence.includes('?') || 
          sentence.toLowerCase().startsWith('how') ||
          sentence.toLowerCase().startsWith('what') ||
          sentence.toLowerCase().startsWith('when') ||
          sentence.toLowerCase().startsWith('where') ||
          sentence.toLowerCase().startsWith('why') ||
          sentence.toLowerCase().startsWith('can')) {
        // Categorize, don't store verbatim
        const lowerSentence = sentence.toLowerCase();
        if (lowerSentence.includes('price') || lowerSentence.includes('cost')) {
          questions.push('Pricing inquiry');
        } else if (lowerSentence.includes('when') || lowerSentence.includes('time')) {
          questions.push('Timing question');
        } else if (lowerSentence.includes('how')) {
          questions.push('Process question');
        } else {
          questions.push('General question');
        }
      }
    }

    return [...new Set(questions)]; // Remove duplicates
  }

  private detectObjections(text: string): string[] {
    const objectionPatterns = {
      too_expensive: ['too expensive', 'too much', 'costly', 'pricey', 'overpriced'],
      timing_concerns: ['too soon', 'too late', 'timing', 'not ready'],
      competitor_comparison: ['competitor', 'other option', 'elsewhere', 'someone else'],
      quality_concerns: ['quality', 'reliable', 'trustworthy', 'reviews'],
    };

    const detected: string[] = [];

    for (const [objection, patterns] of Object.entries(objectionPatterns)) {
      if (patterns.some(p => text.includes(p))) {
        detected.push(objection);
      }
    }

    return detected;
  }

  private calculateConfidence(
    intent: string,
    sentiment: string,
    urgency: string,
    keyTopics: string[],
    questionsAsked: string[]
  ): number {
    let confidence = 0.5; // Base

    // Higher confidence if we detected specific patterns
    if (intent !== 'QUESTION') confidence += 0.2;
    if (keyTopics.length > 0) confidence += 0.1;
    if (questionsAsked.length > 0) confidence += 0.1;
    if (urgency !== 'LOW') confidence += 0.1;

    return Math.min(confidence, 1.0);
  }
}
