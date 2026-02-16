/**
 * ReplyController
 *
 * HTTP handlers for generating, approving, editing and rejecting AI replies.
 * Uses request validation schemas and maps service responses to a standard
 * `ApiResponse` envelope.
 */
import { Request, Response, NextFunction } from 'express';
import { ReplyService } from './reply.service';
import { GenerateReplySchema, ApproveReplySchema, EditReplySchema } from './reply.types';
import { ApiResponse } from '../../shared/types/common.types';

const service = new ReplyService();

export class ReplyController {
  /**
   * Generate a reply for an incoming message. Validates input and returns
   * the composed reply data (text, confidence, cost).
   */
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

  /**
   * Approve a generated reply.
   * Validates input and returns the updated reply record (marked APPROVED).
   */
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

  /**
   * Edit an existing generated reply.
   * Validates payload, forwards to service, and returns the updated reply.
   */
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

  /**
   * Reject / delete a generated reply.
   * Expects `replyId` path param and returns the updated reply status.
   */
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
