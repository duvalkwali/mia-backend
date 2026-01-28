import { Request, Response, NextFunction } from 'express';
import { ReplyService } from './reply.service';
import { GenerateReplySchema, ApproveReplySchema, EditReplySchema } from './reply.types';
import { ApiResponse } from '../../shared/types/common.types';

const service = new ReplyService();

export class ReplyController {
  async generateReply(req: Request, res: Response, next: NextFunction) {
    try {
      const input = GenerateReplySchema.parse(req.body);
      const result = await service.generateReply(req.tenantContext!, input);

      const response: ApiResponse = {
        success: true,
        data: result,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async approveReply(req: Request, res: Response, next: NextFunction) {
    try {
      const { replyId } = ApproveReplySchema.parse(req.body);
      const result = await service.approveReply(req.tenantContext!, replyId);

      const response: ApiResponse = {
        success: true,
        data: result,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async editReply(req: Request, res: Response, next: NextFunction) {
    try {
      const input = EditReplySchema.parse(req.body);
      const result = await service.editReply(req.tenantContext!, input);

      const response: ApiResponse = {
        success: true,
        data: result,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async rejectReply(req: Request, res: Response, next: NextFunction) {
    try {
      const { replyId } = req.params;
      const result = await service.rejectReply(req.tenantContext!, replyId);

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
