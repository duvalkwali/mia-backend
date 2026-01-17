import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { TenantContext } from '../../shared/types/common.types';
import { CreateBusinessInput, CreateFAQInput } from './business.types';
import { EmbeddingService } from './embedding.service';
import logger from '../../config/logger';

export class BusinessService {
  private embeddingService = new EmbeddingService();

  async createOrUpdateBusiness(
    ctx: TenantContext,
    input: CreateBusinessInput
  ) {
    // Check if business already exists
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
    } else {
      // Create new business
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
  }

  async getBusiness(ctx: TenantContext) {
    const business = await prisma.business.findUnique({
      where: { tenantId: ctx.tenantId },
      include: {
        faqs: {
          orderBy: { usageCount: 'desc' },
          take: 20,
        },
      },
    });

    if (!business) {
      throw new AppError(404, 'BUSINESS_NOT_FOUND', 'Business not found');
    }

    return business;
  }

  async createFAQ(ctx: TenantContext, input: CreateFAQInput) {
    // Get business
    const business = await prisma.business.findUnique({
      where: { tenantId: ctx.tenantId },
    });

    if (!business) {
      throw new AppError(404, 'BUSINESS_NOT_FOUND', 'Business not found. Create business profile first.');
    }

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

    // COST OPTIMIZATION: Embed immediately if manually approved
    if (faq.manuallyApproved) {
      await this.embeddingService.checkAndEmbedFAQ(faq.id);
    }

    return faq;
  }

  async getFAQs(ctx: TenantContext) {
    const business = await prisma.business.findUnique({
      where: { tenantId: ctx.tenantId },
    });

    if (!business) {
      throw new AppError(404, 'BUSINESS_NOT_FOUND', 'Business not found');
    }

    const faqs = await prisma.fAQ.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: 'desc' },
    });

    return faqs;
  }

  async searchFAQs(ctx: TenantContext, query: string, limit: number = 3) {
    const business = await prisma.business.findUnique({
      where: { tenantId: ctx.tenantId },
    });

    if (!business) {
      return [];
    }

    // COST OPTIMIZATION: Use embedding service which handles both
    // semantic (if embeddings exist) and keyword search (fallback)
    return this.embeddingService.searchFAQs(business.id, query, limit);
  }
}
