/**
 * PromptBuilder
 *
 * Composes the system instruction (cached in Redis) and the dynamic user
 * message (always fresh). The system template now has three injected sections
 * beyond the base style profile:
 *
 *  1. FORBIDDEN PHRASES — hardcoded + seeded GenericAvoidPhrase table
 *  2. YOUR VOCABULARY   — owner's phrases with context (Phase 1 setup)
 *  3. LEARNED FROM YOUR EDITS — high-confidence LearnedStyleRule rows (Phase 2)
 */
import { Business, FAQ, StyleProfile, ContactSignal, LearnedStyleRule } from '@prisma/client';
import { ComposedPrompt } from './reply.types';
import { TemplateCache } from './templateCache';
import prisma from '@/config/database';
import { VocabularyPreferences } from '../style/style.types';

// Loaded once per process start — these are global defaults that rarely change.
// A process restart (deploy) is sufficient to pick up edits.
type AvoidEntry = { phrase: string; variants: string[] };
let _genericAvoidCache: AvoidEntry[] | null = null;

async function getGenericAvoidPhrases(): Promise<AvoidEntry[]> {
  if (_genericAvoidCache === null) {
    _genericAvoidCache = await prisma.genericAvoidPhrase.findMany({
      where: { isActive: true },
      select: { phrase: true, variants: true },
    });
  }
  return _genericAvoidCache;
}

export class PromptBuilder {
  private templateCache = new TemplateCache();

  async build(
    business: Business & { faqs: FAQ[] },
    styleProfile: StyleProfile,
    currentSignal: ContactSignal,
    ephemeralContext: any
  ): Promise<ComposedPrompt> {
    let systemInstruction = await this.templateCache.getSystemTemplate(
      business.tenantId,
      styleProfile.id
    );

    if (!systemInstruction) {
      // Cache miss — fetch supplementary data then build and cache
      const [genericAvoids, learnedRules] = await Promise.all([
        getGenericAvoidPhrases(),
        prisma.learnedStyleRule.findMany({
          where: {
            styleProfileId: styleProfile.id,
            active: true,
            exampleCount: { gte: 3 },
          },
          orderBy: { exampleCount: 'desc' },
          take: 5,
        }),
      ]);

      systemInstruction = this.buildSystemTemplate(
        business,
        styleProfile,
        genericAvoids,
        learnedRules
      );
      await this.templateCache.setSystemTemplate(
        business.tenantId,
        styleProfile.id,
        systemInstruction
      );
    }

    const userMessage = this.buildUserMessage(
      business,
      styleProfile,
      currentSignal,
      ephemeralContext
    );

    return { systemInstruction, userMessage };
  }

  // ─── System template (cached) ──────────────────────────────────────────────

  private buildSystemTemplate(
    business: Business,
    style: StyleProfile,
    genericAvoids: AvoidEntry[],
    learnedRules: LearnedStyleRule[]
  ): string {
    const forbiddenSection = this.buildForbiddenSection(genericAvoids);
    const vocabSection     = this.buildVocabSection(style.vocabularyPreferences as any);
    const learnedSection   = this.buildLearnedSection(learnedRules);

    return `You are MIA.ai, an AI assistant that writes replies for ${business.businessType} businesses.

CRITICAL PRIVACY RULE:
You will NEVER see the actual client's message text. You only see:
- Extracted intent and sentiment
- Business knowledge
- The owner's communication style

Your goal is to sound EXACTLY like the business owner, not like an AI.
${forbiddenSection}
Business Context:
Type: ${business.businessType}
Description: ${business.description}
Primary Goals: ${business.primaryGoals.join(', ')}
Pricing: ${JSON.stringify(business.pricingRanges)}
PRICING RULE: Only mention pricing when the customer explicitly asked about price, cost, or budget. Never volunteer pricing for unrelated questions.

Style Profile:
Tone: ${style.tone}
Emoji Usage: ${style.emojiUsage}
Formality Level: ${style.formality}/10
Humor: ${style.humorLevel}
Sentence Length: ${style.sentenceLengthPref}
CTA Style: ${style.ctaStyle}
Signature Phrases: ${style.signaturePhrases.join(', ')}
Conversation Goal: ${style.conversationGoal}
${vocabSection}${learnedSection}
Reply Generation Rules:
1. Match the style profile EXACTLY
2. Sound human, use natural language
3. Be ${this.getSentenceLengthGuidance(style.sentenceLengthPref)}
4. ${this.getEmojiGuidance(style.emojiUsage)}
5. ${this.getToneGuidance(style.tone)}
6. ${this.getCTAGuidance(style.ctaStyle)}
7. Use signature phrases naturally when appropriate
8. Never exceed 150 words for MVP
9. ONLY address what the customer asked. Never introduce topics they did not raise.
10. If the customer asked a general question (about services, process, etc.) — answer it directly. Do NOT redirect to pricing or booking unless they asked.

Generate ONLY the reply text, no preamble or explanation.`;
  }

  /**
   * Combines the hardcoded four phrases with any active entries from the
   * GenericAvoidPhrase table. Including variants gives the model clear
   * signal about what family of phrasing to avoid.
   */
  private buildForbiddenSection(genericAvoids: AvoidEntry[]): string {
    const hardcoded = [
      '"As an AI..."',
      '"I\'d be happy to help..."',
      '"Thank you for reaching out..."',
      '"I understand your concern..."',
    ];

    const seeded = genericAvoids.map(e => {
      const all = [e.phrase, ...e.variants].map(v => `"${v}"`).join(' / ');
      return all;
    });

    const allLines = [...hardcoded, ...seeded].map(l => `- ${l}`).join('\n');

    return `
FORBIDDEN PHRASES (never use these or any variation):
${allLines}
- Any robotic, template-like, or corporate-sounding language`;
  }

  /**
   * Injects the owner's personal vocabulary defined during setup.
   * Each phrase includes when to use it and (optionally) when to avoid it.
   * Skipped entirely when vocabularyPreferences is null or empty.
   */
  private buildVocabSection(vocab: VocabularyPreferences | null | undefined): string {
    if (!vocab) return '';

    const phrases = vocab.phrases ?? [];
    const avoid   = vocab.avoid   ?? [];
    if (phrases.length === 0 && avoid.length === 0) return '';

    const lines: string[] = ['\nYOUR VOCABULARY:'];

    if (phrases.length > 0) {
      lines.push('Use these phrases when the context matches:');
      for (const p of phrases) {
        let line = `- "${p.text}"`;
        if (p.context) line += ` → use for: ${p.context}`;
        if (p.avoidIn) line += `. AVOID for: ${p.avoidIn}`;
        lines.push(line);
      }
    }

    if (avoid.length > 0) {
      lines.push('\nYOUR PERSONAL AVOID LIST (never use these):');
      for (const a of avoid) lines.push(`- "${a}"`);
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Injects derived style rules that have been confirmed by 3+ edits.
   * Rules with 3–4 examples are framed as tendencies; 5+ become firm instructions.
   * Skipped entirely when no rules have crossed the threshold.
   */
  private buildLearnedSection(rules: LearnedStyleRule[]): string {
    if (rules.length === 0) return '';

    const lines: string[] = ['\nLEARNED FROM YOUR EDITING HISTORY:'];
    for (const r of rules) {
      lines.push(
        r.exampleCount >= 5
          ? `- ${r.rule}`
          : `- You tend to: ${r.rule}`
      );
    }

    return lines.join('\n') + '\n';
  }

  // ─── User message (always dynamic) ────────────────────────────────────────

  private buildUserMessage(
    business: Business & { faqs: FAQ[] },
    style: StyleProfile,
    signal: ContactSignal,
    context: any
  ): string {
    // Only include FAQs that are topically relevant to the current message.
    // Injecting irrelevant FAQs confuses the model into answering the wrong question.
    const relevantFAQs = this.filterRelevantFAQs(business.faqs, signal);
    const faqSection = relevantFAQs.length > 0
      ? `\n\nRelevant FAQ Answers:\n${relevantFAQs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')}`
      : '';

    const contextSection = context?.recentTurns?.length > 0
      ? `\n\nRecent Conversation Summary:\n${context.recentTurns.map((t: any) => `- ${t.summary}`).join('\n')}`
      : '';

    // For sales-oriented intents it makes sense to gently steer toward a goal.
    // For general questions the model should just answer — not try to sell.
    const SALES_INTENTS = ['PRICING', 'BOOKING', 'AVAILABILITY', 'OBJECTION'];
    const goalInstruction = SALES_INTENTS.includes(signal.intent)
      ? `3. Gently advance toward: ${business.primaryGoals[0]}`
      : '3. Answer the question directly and completely — do not redirect to sales or pricing';

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
${goalInstruction}
4. Sounds exactly like the business owner (not AI)
5. Is ${this.getSentenceLengthGuidance(style.sentenceLengthPref)}

Reply:`;
  }

  // ─── FAQ relevance filter ─────────────────────────────────────────────────

  /**
   * Scores each FAQ by keyword overlap with the current signal's topics,
   * questions, and intent, then returns the top matches (max 5).
   * Returns an empty array — no FAQs — when nothing is relevant, which is
   * better than injecting unrelated Q&A that misleads the model.
   */
  private filterRelevantFAQs(faqs: FAQ[], signal: ContactSignal): FAQ[] {
    if (faqs.length === 0) return [];

    const terms = [
      ...signal.keyTopics,
      ...signal.questionsAsked,
      signal.intent.toLowerCase(),
    ].map(t => t.toLowerCase());

    if (terms.length === 0) return faqs.slice(0, 3);

    const scored = faqs.map(faq => {
      const haystack = `${faq.question} ${faq.answer}`.toLowerCase();
      const score = terms.filter(t => haystack.includes(t)).length;
      return { faq, score };
    });

    return scored
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ faq }) => faq);
  }

  // ─── Guidance helpers ──────────────────────────────────────────────────────

  private getSentenceLengthGuidance(pref: string): string {
    switch (pref) {
      case 'SHORT':  return 'concise (1-2 sentences max)';
      case 'MEDIUM': return 'moderate length (2-4 sentences)';
      case 'LONG':   return 'detailed (4-6 sentences)';
      default:       return 'moderate length';
    }
  }

  private getEmojiGuidance(usage: string): string {
    switch (usage) {
      case 'NONE':     return 'Use NO emojis';
      case 'LIGHT':    return 'Use 1-2 emojis maximum';
      case 'FREQUENT': return 'Use 3-5 emojis naturally';
      default:         return 'Use emojis sparingly';
    }
  }

  private getToneGuidance(tone: string): string {
    switch (tone) {
      case 'FRIENDLY':     return 'Be warm and approachable';
      case 'PROFESSIONAL': return 'Be polished and business-like';
      case 'PLAYFUL':      return 'Be fun and energetic';
      case 'PREMIUM':      return 'Be sophisticated and exclusive';
      default:             return 'Be professional';
    }
  }

  private getCTAGuidance(cta: string): string {
    switch (cta) {
      case 'DIRECT':       return 'End with a clear, direct call-to-action';
      case 'SOFT':         return 'Suggest next steps gently';
      case 'CONSULTATIVE': return 'Ask questions to understand their needs';
      default:             return 'Include an appropriate next step';
    }
  }
}
