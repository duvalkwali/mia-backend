/**
 * PromptBuilder
 *
 * Responsible for composing the system instruction (cached) and the
 * dynamic user message containing signals + relevant FAQs. Caching the
 * system instruction reduces cost and latency by reusing tenant/style
 * specific templates while keeping the user message dynamic.
 */
import { Business, FAQ, StyleProfile, ContactSignal } from '@prisma/client';
import { ComposedPrompt } from './reply.types';
import { TemplateCache } from './templateCache';

export class PromptBuilder {
  private templateCache = new TemplateCache();

  async build(
    business: Business & { faqs: FAQ[] },
    styleProfile: StyleProfile,
    currentSignal: ContactSignal,
    ephemeralContext: any
  ): Promise<ComposedPrompt> {
    // COST OPTIMIZATION: Try to get cached system template
    let systemInstruction = await this.templateCache.getSystemTemplate(
      business.tenantId,
      styleProfile.id
    );

    if (!systemInstruction) {
      // Cache miss - build and cache template
      systemInstruction = this.buildSystemTemplate(business, styleProfile);
      await this.templateCache.setSystemTemplate(
        business.tenantId,
        styleProfile.id,
        systemInstruction
      );
    }

    // User message is always dynamic (contains current signal)
    const userMessage = this.buildUserMessage(
      business,
      styleProfile,
      currentSignal,
      ephemeralContext
    );

    return {
      systemInstruction,
      userMessage,
    };
  }

  /**
   * Build static system template (CACHED)
   * Contains only tenant-specific info that rarely changes
   */
  private buildSystemTemplate(business: Business, style: StyleProfile): string {
    return `You are MIA.ai, an AI assistant that writes replies for ${business.businessType} businesses.

CRITICAL PRIVACY RULE:
You will NEVER see the actual client's message text. You only see:
- Extracted intent and sentiment
- Business knowledge
- The owner's communication style

Your goal is to sound EXACTLY like the business owner, not like an AI.

FORBIDDEN PHRASES (never use these):
- "As an AI..."
- "I'd be happy to help..."
- "Thank you for reaching out..."
- "I understand your concern..."
- Any robotic or template-like language

Business Context:
Type: ${business.businessType}
Description: ${business.description}
Primary Goals: ${business.primaryGoals.join(', ')}
Pricing: ${JSON.stringify(business.pricingRanges)}

Style Profile:
Tone: ${style.tone}
Emoji Usage: ${style.emojiUsage}
Formality Level: ${style.formality}/10
Humor: ${style.humorLevel}
Sentence Length: ${style.sentenceLengthPref}
CTA Style: ${style.ctaStyle}
Signature Phrases: ${style.signaturePhrases.join(', ')}
Conversation Goal: ${style.conversationGoal}

Reply Generation Rules:
1. Match the style profile EXACTLY
2. Sound human, use natural language
3. Be ${this.getSentenceLengthGuidance(style.sentenceLengthPref)}
4. ${this.getEmojiGuidance(style.emojiUsage)}
5. ${this.getToneGuidance(style.tone)}
6. ${this.getCTAGuidance(style.ctaStyle)}
7. Use signature phrases naturally when appropriate
8. Never exceed 150 words for MVP

Generate ONLY the reply text, no preamble or explanation.`;
  }

  /**
   * Build dynamic user message (NOT CACHED)
   * Contains current signal, context, and relevant FAQs
   */
  private buildUserMessage(
    business: Business & { faqs: FAQ[] },
    style: StyleProfile,
    signal: ContactSignal,
    context: any
  ): string {
    // Include all FAQs (up to 10) so the AI always has full knowledge base
    const relevantFAQs = business.faqs.slice(0, 10);
    const faqSection = relevantFAQs.length > 0
      ? `\n\nRelevant FAQ Answers:\n${relevantFAQs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')}`
      : '';

    // Build context section
    const contextSection = context?.recentTurns?.length > 0
      ? `\n\nRecent Conversation Summary:\n${context.recentTurns.map((t: any) => `- ${t.summary}`).join('\n')}`
      : '';

    return `Contact Analysis:
Intent: ${signal.intent}
Sentiment: ${signal.sentiment}
Urgency: ${signal.urgency}
Funnel Stage: ${signal.funnelStage}
Key Topics: ${signal.keyTopics.join(', ') || 'None'}
Questions Asked: ${signal.questionsAsked.join(', ') || 'None'}
Objections: ${signal.objectionsRaised.join(', ') || 'None'}${faqSection}${contextSection}

Task:
Generate a reply that:
1. Addresses the ${signal.intent} intent
2. Matches the ${signal.sentiment} sentiment appropriately
3. Advances toward: ${business.primaryGoals[0]}
4. Sounds exactly like the business owner (not AI)
5. Is ${this.getSentenceLengthGuidance(style.sentenceLengthPref)}

Reply:`;
  }

  /**
   * Returns a short human-readable guidance string used in system prompts
   * that describes the desired sentence length for generated replies.
   */
  private getSentenceLengthGuidance(pref: string): string {
    switch (pref) {
      case 'SHORT': return 'concise (1-2 sentences max)';
      case 'MEDIUM': return 'moderate length (2-4 sentences)';
      case 'LONG': return 'detailed (4-6 sentences)';
      default: return 'moderate length';
    }
  }

  /**
   * Returns guidance text describing acceptable emoji usage for prompts
   * based on the style profile's emoji preference.
   */
  private getEmojiGuidance(usage: string): string {
    switch (usage) {
      case 'NONE': return 'Use NO emojis';
      case 'LIGHT': return 'Use 1-2 emojis maximum';
      case 'FREQUENT': return 'Use 3-5 emojis naturally';
      default: return 'Use emojis sparingly';
    }
  }

  /**
   * Maps style tone keys to short prompt guidance strings so the AI can
   * consistently replicate the requested tone.
   */
  private getToneGuidance(tone: string): string {
    switch (tone) {
      case 'FRIENDLY': return 'Be warm and approachable';
      case 'PROFESSIONAL': return 'Be polished and business-like';
      case 'PLAYFUL': return 'Be fun and energetic';
      case 'PREMIUM': return 'Be sophisticated and exclusive';
      default: return 'Be professional';
    }
  }

  /**
   * Returns guidance describing the preferred CTA style (direct, soft, or consultative)
   * used when composing the system instruction for a tenant.
   */
  private getCTAGuidance(cta: string): string {
    switch (cta) {
      case 'DIRECT': return 'End with a clear, direct call-to-action';
      case 'SOFT': return 'Suggest next steps gently';
      case 'CONSULTATIVE': return 'Ask questions to understand their needs';
      default: return 'Include an appropriate next step';
    }
  }
}
