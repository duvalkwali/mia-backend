import { Request, Response, NextFunction } from 'express';
import { StyleService } from './style.service';
import {
  OnboardingQuizSchema,
  RecordLearningEventSchema,
} from './style.types';
import { ApiResponse } from '../../shared/types/common.types';

// Create one instance of the service
const service = new StyleService();

/**
 * Controller = HTTP layer
 * It does NOT contain business logic.
 */
export class StyleController {

  /**
   * Create or update the AI style profile
   * Called during onboarding.
   */
  async createStyleProfile(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate request body
      const input = OnboardingQuizSchema.parse(req.body);

      // Delegate logic to service
      const result = await service.createStyleProfile(
        req.tenantContext!,
        input
      );

      const response: ApiResponse = {
        success: true,
        data: result,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error); // Forward errors to errorHandler middleware
    }
  }

  /**
   * Fetch existing style profile
   */
  async getStyleProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.getStyleProfile(req.tenantContext!);

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
   * Record how a user reacted to an AI reply
   * This feeds learning + personalization.
   */
  async recordLearningEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const input = RecordLearningEventSchema.parse(req.body);

      const result = await service.recordLearningEvent(
        req.tenantContext!,
        input
      );

      const response: ApiResponse = {
        success: true,
        data: result,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
}

