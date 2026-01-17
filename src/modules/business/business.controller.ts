import { Request, Response, NextFunction } from 'express';
import { BusinessService } from './business.service';
import { CreateBusinessSchema, CreateFAQSchema } from './business.types';
import { ApiResponse } from '../../shared/types/common.types';

const service = new BusinessService();

export class BusinessController {
  async createOrUpdateBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      const input = CreateBusinessSchema.parse(req.body);
      const result = await service.createOrUpdateBusiness(req.tenantContext!, input);

      const response: ApiResponse = {
        success: true,
        data: result,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async getBusiness(req: Request, res: Response, next: NextFunction) {
    try {
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

  async createFAQ(req: Request, res: Response, next: NextFunction) {
    try {
      const input = CreateFAQSchema.parse(req.body);
      const result = await service.createFAQ(req.tenantContext!, input);

      const response: ApiResponse = {
        success: true,
        data: result,
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  async getFAQs(req: Request, res: Response, next: NextFunction) {
    try {
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
