/**
 * Rules-based signal extractor for customer messages.
 * Uses pattern matching and keyword analysis to extract signals without AI costs.
 * Handles 70-80% of common patterns with high accuracy.
 */

import logger from '../../../config/logger';

/**
 * Interface for extracted signals from customer messages.
 */
export interface ExtractedSignals {
  intent: string; // Customer intent category
  sentiment: string; // Sentiment analysis result
  urgency: string; // Urgency level
  funnelStage: string; // Sales funnel position
  keyTopics: string[]; // Main topics discussed
  questionsAsked: string[]; // Categories of questions
  objectionsRaised: string[]; // Types of objections
  confidence: number; // 0-1, how confident we are
}

/**
 * COST OPTIMIZATION: Rules-based signal extraction
 * 
 * This is FREE and handles 70-80% of common patterns.
 * Falls back to AI only when confidence is low.
 */
export class RulesExtractor {
  /**
   * Extracts signals from message text using rules and pattern matching.
   * Analyzes text for keywords, patterns, and linguistic cues.
   *
   * @param messageText - The customer message to analyze
   * @returns ExtractedSignals object with confidence score
   */
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

  /**
   * Detects customer intent based on keyword patterns.
   * @param text - Lowercase message text
   * @returns Detected intent category
   */
  private detectIntent(text: string): string {
    const patterns = {
      PRICING: ['price', 'cost', 'how much',  'expensive', 'cheap', 'afford', 'budget', 'rate', 'fee'],
      AVAILABILITY: ['available', 'when', 'schedule', 'time', 'date', 'free', 'busy', 'open'],
      BOOKING: ['book', 'reserve', 'appointment', 'schedule', 'confirm', 'slot'],
      OBJECTION: ['but', 'however', 'concern', 'worried', 'not sure', 'hesitant', 'problem'],
      GREETING: ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'],
      COMPLAINT: ['disappointed', 'unhappy', 'bad', 'terrible', 'awful', 'worst', 'refund', 'shitty'],
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

  /**
   * Analyzes sentiment based on positive/negative/hesitant keywords.
   * @param text - Lowercase message text
   * @returns Sentiment category
   */
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

  /**
   * Determines urgency level from urgency keywords.
   * @param text - Lowercase message text
   * @returns Urgency level
   */
  private detectUrgency(text: string): string {
    const highUrgency = ['urgent', 'asap', 'immediately', 'emergency', 'now', 'today', 'right away'];
    const mediumUrgency = ['soon', 'this week', 'quickly', 'fast'];

    if (highUrgency.some(w => text.includes(w))) return 'HIGH';
    if (mediumUrgency.some(w => text.includes(w))) return 'MEDIUM';

    return 'LOW';
  }

  /**
   * Infers sales funnel stage based on message content and intent.
   * @param text - Lowercase message text
   * @param intent - Detected intent
   * @returns Funnel stage
   */
  private inferFunnelStage(text: string, intent: string): string {
    if (intent === 'GREETING') return 'LEAD';
    if (intent === 'PRICING' || intent === 'AVAILABILITY') return 'INTERESTED';
    if (intent === 'BOOKING') return 'NEGOTIATING';
    if (intent === 'OBJECTION') return 'NEGOTIATING';
    if (text.includes('confirm') || text.includes('yes')) return 'CLOSED';

    return 'LEAD';
  }

  /**
   * Extracts main topics discussed in the message.
   * @param text - Lowercase message text
   * @returns Array of detected topics (max 3)
   */
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

  /**
   * Identifies and categorizes questions in the message.
   * @param messageText - Original message text
   * @returns Array of question categories
   */
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

  /**
   * Detects common objection patterns in the message.
   * @param text - Lowercase message text
   * @returns Array of objection categories
   */
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

  /**
   * Calculates confidence score based on detection results.
   *
   * Scoring pattern (explainable heuristics used for MVP):
   * - Base score: 0.5
   * - Intent: +0.20 if intent is NOT 'QUESTION' (questions are weaker signals)
   * - Key topics: +0.04 per detected topic, capped at +0.12 (diminishing returns)
   * - Questions detected: +0.10 (explicit question = stronger extraction)
   * - Urgency: +0.10 if urgency is MEDIUM/HIGH
   * - Sentiment:
   *     - POSITIVE or NEGATIVE => +0.10 (strong directional signal)
   *     - HESITANT => -0.05 (indicates uncertainty)
   * - Contradiction penalties: small -0.10 adjustments for clear mismatches
   *
   * Rationale: We combine orthogonal signals (intent, topics, urgency,
   * sentiment and explicit questions) using small, explainable weights.
   * This keeps the heuristic fast, interpretable, and easy to tune.
   * Final score is clamped to [0, 1].
   *
   * @param intent - Detected intent (string label)
   * @param sentiment - Detected sentiment (POSITIVE/NEGATIVE/HESITANT/NEUTRAL)
   * @param urgency - Detected urgency (LOW/MEDIUM/HIGH)
   * @param keyTopics - Extracted topics
   * @param questionsAsked - Detected questions
   * @returns Confidence score between 0 and 1
   */
  private calculateConfidence(
    intent: string,
    sentiment: string,
    urgency: string,
    keyTopics: string[],
    questionsAsked: string[]
  ): number {
    let confidence = 0.5; // Base confidence

    // Intent presence is a strong signal (questions are default / weak)
    if (intent !== 'QUESTION') confidence += 0.2;

    // Key topics -> small boost with diminishing returns
    if (keyTopics.length > 0) {
      confidence += Math.min(0.12, 0.04 * keyTopics.length);
    }

    // Detecting explicit questions increases confidence
    if (questionsAsked.length > 0) confidence += 0.1;

    // Urgency bump for anything above LOW
    if (urgency !== 'LOW') confidence += 0.1;

    // Sentiment adds important signal:
    // - POSITIVE / NEGATIVE: stronger signal -> +0.1
    // - HESITANT: indicates uncertainty -> -0.05
    // - NEUTRAL: no change
    switch (sentiment) {
      case 'POSITIVE':
      case 'NEGATIVE':
        confidence += 0.1;
        break;
      case 'HESITANT':
        confidence -= 0.05;
        break;
      default:
        break;
    }

    // Simple contradiction penalties (small heuristics)
    if (intent === 'COMPLAINT' && sentiment === 'POSITIVE') confidence -= 0.1;
    if (intent === 'THANKS' && sentiment === 'NEGATIVE') confidence -= 0.1;

    // Clamp between 0 and 1
    return Math.max(0, Math.min(confidence, 1.0));
  }
}
