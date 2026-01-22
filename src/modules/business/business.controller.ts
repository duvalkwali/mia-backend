import { Request, Response, NextFunction } from 'express';
import { BusinessService } from './business.service';
import { CreateBusinessSchema, CreateFAQSchema } from './business.types';
import { ApiResponse } from '../../shared/types/common.types';

/**
 * Create a single instance of BusinessService
 * This service contains all business-related logic
 */
const service = new BusinessService();

/**
 * ============================
 * BUSINESS CONTROLLER
 * ============================
 *
 * This controller handles HTTP requests related to:
 * - Business configuration
 * - FAQs management
 *
 * Responsibilities:
 * - Validate incoming request data using Zod
 * - Extract tenant context (multi-tenant support)
 * - Call the appropriate service methods
 * - Format and return API responses
 *
 * IMPORTANT:
 * - Controllers do NOT contain business logic
 * - Controllers do NOT access the database directly
 */
export class BusinessController {

  /**
   * Create or update the business configuration for the current tenant
   *
   * This endpoint is usually called during onboarding
   * or when a business updates its profile.
   */
  async createOrUpdateBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate and parse request body using Zod
      const input = CreateBusinessSchema.parse(req.body);

      // Call service with tenant context to ensure tenant isolation
      const result = await service.createOrUpdateBusiness(
        req.tenantContext!,
        input
      );

      // Standardized API response
      const response: ApiResponse = {
        success: true,
        data: result,
      };

      res.json(response);
    } catch (error) {
      // Forward errors to the global error handler
      next(error);
    }
  }

  /**
   * Retrieve the business configuration for the current tenant
   */
  async getBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      // Fetch business data scoped to the current tenant
      const result = await service.getBusiness(req.tenantContext!);

      const response: ApiResponse = {
        success: true,
        data: result,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new FAQ entry for the current tenant
   *
   * FAQs are used by the AI system to answer customer questions
   */
  async createFAQ(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate and parse FAQ input
      const input = CreateFAQSchema.parse(req.body);

      // Create FAQ scoped to the current tenant
      const result = await service.createFAQ(
        req.tenantContext!,
        input
      );

      const response: ApiResponse = {
        success: true,
        data: result,
      };

      // 201 Created indicates a new resource was created
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieve all FAQs for the current tenant
   */
  async getFAQs(req: Request, res: Response, next: NextFunction) {
    try {
      // Fetch all FAQs belonging to the tenant
      const result = await service.getFAQs(req.tenantContext!);

      const response: ApiResponse = {
        success: true,
        data: result,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}

