import { Request, Response, NextFunction } from 'express';
import { StyleService } from './style.service';
import { OnboardingQuizSchema, RecordLearningEventSchema } from './style.types';
import { ApiResponse } from '../../shared/types/common.types';

const service = new StyleService();

export class StyleController {
  async createStyleProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const input = OnboardingQuizSchema.parse(req.body);
      const result = await service.createStyleProfile(req.tenantContext!, input);

      const response: ApiResponse = {
        success: true,
        data: result,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

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

  async recordLearningEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const input = RecordLearningEventSchema.parse(req.body);
      const result = await service.recordLearningEvent(req.tenantContext!, input);

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
