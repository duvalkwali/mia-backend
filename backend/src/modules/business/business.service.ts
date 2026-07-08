import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { TenantContext } from '../../shared/types/common.types';
import { CreateBusinessInput, CreateFAQInput, UpdateProfileInput } from './business.types';
import { EmbeddingService } from './embedding.service';
import logger from '../../config/logger';

/**
 * ============================
 * BUSINESS SERVICE
 * ============================
 *
 * This service contains ALL business-related logic:
 * - Business profile creation & updates
 * - FAQ management
 * - AI embedding orchestration
 * - Tenant isolation enforcement
 *
 * IMPORTANT:
 * - This file does NOT handle HTTP
 * - This file DOES enforce business rules
 */
export class BusinessService {

  /**
   * Embedding service is responsible for:
   * - Creating embeddings
   * - Searching FAQs efficiently
   * - Optimizing AI-related costs
   */
  private embeddingService = new EmbeddingService();

  /**
   * Create or update the business profile for a tenant
   */
  async createOrUpdateBusiness(
    ctx: TenantContext,
    input: CreateBusinessInput
  ) {

    // Check if a business already exists for this tenant
    const existing = await prisma.business.findUnique({
      where: { tenantId: ctx.tenantId },
    });

    if (existing) {
      // Update existing business
      const updated = await prisma.business.update({
        where: { id: existing.id },
        data: {
          businessType: input.businessType,
          description: input.description,
          pricingRanges: input.pricingRanges,
          primaryGoals: input.primaryGoals,
          allowedClaims: input.allowedClaims || [],
          constraints: input.constraints || {},
        },
      });

      logger.info('Business updated', {
        tenantId: ctx.tenantId,
        businessId: updated.id,
      });

      return updated;
    }

    // Create new business profile
    const created = await prisma.business.create({
      data: {
        tenantId: ctx.tenantId,
        businessType: input.businessType,
        description: input.description,
        pricingRanges: input.pricingRanges,
        primaryGoals: input.primaryGoals,
        allowedClaims: input.allowedClaims || [],
        constraints: input.constraints || {},
      },
    });

    logger.info('Business created', {
      tenantId: ctx.tenantId,
      businessId: created.id,
    });

    return created;
  }

  /**
   * Partial upsert for the dashboard profile form (PUT /business/profile).
   *
   * Only fields present in the request are written; everything else
   * (primaryGoals, allowedClaims, other constraints keys) keeps its stored
   * value. `pricing` free text maps to the canonical `pricingRanges: { text }`
   * and `targetAudience` is merged into the `constraints` JSON.
   */
  async updateProfileFields(ctx: TenantContext, input: UpdateProfileInput) {
    const existing = await prisma.business.findUnique({
      where: { tenantId: ctx.tenantId },
    });

    if (existing) {
      const data: Record<string, unknown> = {};
      if (input.businessType) data.businessType = input.businessType;
      if (input.description !== undefined) data.description = input.description;
      if (input.pricing !== undefined) data.pricingRanges = { text: input.pricing };
      if (input.targetAudience !== undefined) {
        const constraints =
          existing.constraints && typeof existing.constraints === 'object' && !Array.isArray(existing.constraints)
            ? (existing.constraints as Record<string, unknown>)
            : {};
        data.constraints = { ...constraints, targetAudience: input.targetAudience };
      }

      const updated = await prisma.business.update({
        where: { id: existing.id },
        data,
      });

      logger.info('Business profile updated', {
        tenantId: ctx.tenantId,
        businessId: updated.id,
        fields: Object.keys(data),
      });

      return updated;
    }

    // First save from the dashboard: create with neutral defaults for the
    // fields the flat form doesn't cover.
    const created = await prisma.business.create({
      data: {
        tenantId: ctx.tenantId,
        businessType: input.businessType || 'OTHER',
        description: input.description ?? '',
        pricingRanges: { text: input.pricing ?? '' },
        primaryGoals: ['support'],
        allowedClaims: [],
        constraints: input.targetAudience !== undefined ? { targetAudience: input.targetAudience } : {},
      },
    });

    logger.info('Business profile created', {
      tenantId: ctx.tenantId,
      businessId: created.id,
    });

    return created;
  }

  /**
   * Retrieve business profile along with most-used FAQs
   */
  async getBusiness(ctx: TenantContext) {
    const business = await prisma.business.findUnique({
      where: { tenantId: ctx.tenantId },
      include: {
        faqs: {
          orderBy: { usageCount: 'desc' },
          take: 20, // Limit to most relevant FAQs
        },
      },
    });

    if (!business) {
      throw new AppError(404, 'BUSINESS_NOT_FOUND', 'Business not found');
    }

    return business;
  }

  /**
   * Create a new FAQ entry
   */
  async createFAQ(ctx: TenantContext, input: CreateFAQInput) {

    // Ensure business exists
    const business = await prisma.business.findUnique({
      where: { tenantId: ctx.tenantId },
    });

    if (!business) {
      throw new AppError(
        404,
        'BUSINESS_NOT_FOUND',
        'Business not found. Create business profile first.'
      );
    }

    // Create FAQ
    const faq = await prisma.fAQ.create({
      data: {
        businessId: business.id,
        question: input.question,
        answer: input.answer,
        tags: input.tags || [],
        isAiGenerated: false,
        frozen: false,
        manuallyApproved: input.manuallyApproved || false,
      },
    });

    logger.info('FAQ created', {
      tenantId: ctx.tenantId,
      faqId: faq.id,
      manuallyApproved: faq.manuallyApproved,
    });

    /**
     * COST OPTIMIZATION:
     * Only generate embeddings immediately if the FAQ
     * is manually approved by the business owner.
     *
     * This avoids embedding low-quality or temporary FAQs.
     */
    if (faq.manuallyApproved) {
      await this.embeddingService.checkAndEmbedFAQ(faq.id);
    }

    return faq;
  }

  /**
   * Retrieve all FAQs for the tenant
   */
  async getFAQs(ctx: TenantContext) {
    const business = await prisma.business.findUnique({
      where: { tenantId: ctx.tenantId },
    });

    if (!business) {
      throw new AppError(404, 'BUSINESS_NOT_FOUND', 'Business not found');
    }

    return prisma.fAQ.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Delete a FAQ by ID, scoped to the current tenant
   */
  async deleteFAQ(ctx: TenantContext, faqId: string) {
    const business = await prisma.business.findUnique({
      where: { tenantId: ctx.tenantId },
    });

    if (!business) {
      throw new AppError(404, 'BUSINESS_NOT_FOUND', 'Business not found');
    }

    const faq = await prisma.fAQ.findUnique({ where: { id: faqId } });

    if (!faq || faq.businessId !== business.id) {
      throw new AppError(404, 'FAQ_NOT_FOUND', 'FAQ not found');
    }

    await prisma.fAQ.delete({ where: { id: faqId } });
    logger.info('FAQ deleted', { tenantId: ctx.tenantId, faqId });
    return { deleted: true, id: faqId };
  }

  async isAutoReplyEnabled(ctx: TenantContext): Promise<boolean> {
    const business = await prisma.business.findUnique({
      where: { tenantId: ctx.tenantId },
      select: { autoReplyEnabled: true },
    });
    return business?.autoReplyEnabled ?? false;
  }

  async setAutoReply(ctx: TenantContext, enabled: boolean) {
    const business = await prisma.business.findUnique({
      where: { tenantId: ctx.tenantId },
    });
    if (!business) {
      throw new AppError(404, 'BUSINESS_NOT_FOUND', 'Create a business profile first');
    }
    await prisma.business.update({
      where: { tenantId: ctx.tenantId },
      data: { autoReplyEnabled: enabled },
    });
    logger.info('Auto-reply setting updated', { tenantId: ctx.tenantId, enabled });
    return { autoReplyEnabled: enabled };
  }

  /**
   * Search FAQs using semantic or keyword search
   *
   * This method is used by the AI reply system
   */
  async searchFAQs(
    ctx: TenantContext,
    query: string,
    limit: number = 3
  ) {
    const business = await prisma.business.findUnique({
      where: { tenantId: ctx.tenantId },
    });

    if (!business) {
      return [];
    }

    /**
     * COST OPTIMIZATION:
     * - Use embeddings when available
     * - Fall back to keyword search otherwise
     */
    return this.embeddingService.searchFAQs(
      business.id,
      query,
      limit
    );
  }
}
