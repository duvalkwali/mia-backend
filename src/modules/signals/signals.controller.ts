import { Request, Response, NextFunction } from 'express';
import { SignalsService } from './signals.service';
import { ExtractSignalsSchema } from './signals.types';
import { ApiResponse } from '../../shared/types/common.types';

const service = new SignalsService();

export class SignalsController {
  async extractSignals(req: Request, res: Response, next: NextFunction) {
    try {
      const input = ExtractSignalsSchema.parse(req.body);
      const result = await service.extractSignals(req.tenantContext!, input);

      const response: ApiResponse = {
        success: true,
        data: result,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async getContactSignals(req: Request, res: Response, next: NextFunction) {
    try {
      const { contactId } = req.params;
      const result = await service.getContactSignals(req.tenantContext!, contactId);

      const response: ApiResponse = {
        success: true,
        data: result,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async getCurrentState(req: Request, res: Response, next: NextFunction) {
    try {
      const { contactId } = req.params;
      const result = await service.getCurrentContactState(req.tenantContext!, contactId);

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
