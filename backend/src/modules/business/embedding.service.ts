import openai, { AI_MODELS, calculateCost } from '../../config/openai';
import prisma from '../../config/database';
import logger from '../../config/logger';
import { CostMetrics } from '../../shared/types/common.types';

export class EmbeddingService {
  private readonly EMBEDDING_THRESHOLD = parseInt(
    process.env.FAQ_EMBEDDING_THRESHOLD || '3'
  );
  private readonly EMBEDDING_ENABLED =
    process.env.FAQ_EMBEDDING_ENABLED === 'true';

  /**
   * COST OPTIMIZATION: Only embed FAQs that meet criteria
   * 
   * Criteria:
   * 1. Manually approved by user, OR
   * 2. Used >= threshold times, OR
   * 3. Marked as "important" during onboarding
   */
  async checkAndEmbedFAQ(faqId: string): Promise<CostMetrics | null> {
    if (!this.EMBEDDING_ENABLED) {
      return null;
    }

    const faq = await prisma.fAQ.findUnique({ where: { id: faqId } });

    if (!faq || faq.isEmbedded) {
      return null; // Already embedded or doesn't exist
    }

    // Check if FAQ meets embedding criteria
    const shouldEmbed =
      faq.manuallyApproved || faq.usageCount >= this.EMBEDDING_THRESHOLD;

    if (!shouldEmbed) {
      logger.debug('FAQ does not meet embedding criteria yet', {
        faqId,
        usageCount: faq.usageCount,
        threshold: this.EMBEDDING_THRESHOLD,
      });
      return null;
    }

    // Generate embedding
    logger.info('Embedding FAQ', {
      faqId,
      reason: faq.manuallyApproved ? 'manually_approved' : 'usage_threshold',
    });

    const text = `${faq.question}\n${faq.answer}`;
    
    const response = await openai.embeddings.create({
      model: AI_MODELS.EMBEDDING,
      input: text,
    });

    const embedding = response.data[0].embedding;
    const tokensUsed = response.usage?.total_tokens || 0;
    const cost = calculateCost(AI_MODELS.EMBEDDING, tokensUsed);

    // Store embedding
    await prisma.fAQ.update({
      where: { id: faqId },
      data: {
        embedding,
        isEmbedded: true,
        embeddedAt: new Date(),
      },
    });

    // Track cost
    await this.trackCost(faq.businessId, tokensUsed, cost);

    logger.info('FAQ embedded successfully', {
      faqId,
      tokensUsed,
      costUsd: cost,
    });

    return {
      operation: 'faq_embedding',
      modelUsed: AI_MODELS.EMBEDDING,
      tokensUsed,
      costUsd: cost,
    };
  }

  /**
   * Semantic search over embedded FAQs
   * Falls back to keyword search if no embeddings exist
   */
  async searchFAQs(
    businessId: string,
    query: string,
    limit: number = 3
  ): Promise<any[]> {
    // Check if any FAQs are embedded
    const embeddedCount = await prisma.fAQ.count({
      where: { businessId, isEmbedded: true },
    });

    if (embeddedCount === 0) {
      logger.debug('No embedded FAQs, using keyword search');
      return this.keywordSearch(businessId, query, limit);
    }

    // Generate query embedding
    const response = await openai.embeddings.create({
      model: AI_MODELS.EMBEDDING,
      input: query,
    });

    const queryEmbedding = response.data[0].embedding;

    // Find similar FAQs using cosine similarity
    // Note: PostgreSQL doesn't have native vector similarity
    // For MVP, we'll fetch all embedded FAQs and compute in-memory
    // In V1, use pgvector extension for efficiency
    const embeddedFAQs = await prisma.fAQ.findMany({
      where: { businessId, isEmbedded: true },
    });

    const withScores = embeddedFAQs.map((faq) => ({
      faq,
      score: this.cosineSimilarity(queryEmbedding, faq.embedding),
    }));

    withScores.sort((a, b) => b.score - a.score);

    const topFAQs = withScores.slice(0, limit).map((item) => item.faq);

    // Update usage counts
    await Promise.all(
      topFAQs.map((faq) =>
        prisma.fAQ.update({
          where: { id: faq.id },
          data: { usageCount: { increment: 1 } },
        })
      )
    );

    return topFAQs;
  }

  /**
   * Fallback keyword search when no embeddings exist
   */
  private async keywordSearch(
    businessId: string,
    query: string,
    limit: number
  ): Promise<any[]> {
    const faqs = await prisma.fAQ.findMany({
      where: {
        businessId,
        OR: [
          { question: { contains: query, mode: 'insensitive' } },
          { answer: { contains: query, mode: 'insensitive' } },
          { tags: { hasSome: [query.toLowerCase()] } },
        ],
      },
      take: limit,
      orderBy: { usageCount: 'desc' },
    });

    // Update usage counts and check for embedding
    await Promise.all(
      faqs.map(async (faq) => {
        await prisma.fAQ.update({
          where: { id: faq.id },
          data: { usageCount: { increment: 1 } },
        });

        // Check if FAQ should now be embedded
        await this.checkAndEmbedFAQ(faq.id);
      })
    );

    return faqs;
  }

  /**
   * Cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  private async trackCost(
    businessId: string,
    tokensUsed: number,
    costUsd: number
  ) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) return;

    await prisma.costTracking.create({
      data: {
        tenantId: business.tenantId,
        operation: 'faq_embedding',
        modelUsed: AI_MODELS.EMBEDDING,
        tokensUsed,
        costUsd,
      },
    });
  }
}
