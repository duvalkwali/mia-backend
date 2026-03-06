/**
 * Signals controller for handling signal extraction and retrieval requests.
 * Provides endpoints for extracting signals from messages and fetching contact signals.
 */

import { Request, Response, NextFunction } from 'express';
import { SignalsService } from './signals.service';
import { ReplyService } from '../ai-reply/reply.service';
import { ExtractSignalsSchema } from './signals.types';
import { ApiResponse } from '../../shared/types/common.types';

const service = new SignalsService();
const replyService = new ReplyService();

/**
 * Controller class for signals-related operations.
 */
export class SignalsController {
  /**
   * Extracts signals from a customer message.
   * Validates input, processes the message through the signals service, and returns extracted signals.
   *
   * @param req - Express request containing message data
   * @param res - Express response object
   * @param next - Express next function for error handling
   */
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

  /**
   * Retrieves signal history for a specific contact.
   * Fetches the last 10 signals for the contact, ordered by extraction time.
   *
   * @param req - Express request with contactId parameter
   * @param res - Express response object
   * @param next - Express next function for error handling
   */
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

  /**
   * Gets the current state (most recent signal) for a contact.
   * Returns the latest signal data representing the contact's current status.
   *
   * @param req - Express request with contactId parameter
   * @param res - Express response object
   * @param next - Express next function for error handling
   */
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

  /** List all signals for the tenant (frontend signals table) */
  async listSignals(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.listSignals(req.tenantContext!);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /** Generate a reply from an existing signal by ID */
  async generateReplyFromSignal(req: Request, res: Response, next: NextFunction) {
    try {
      const { signalId } = req.params;
      const result = await service.generateReplyFromSignal(req.tenantContext!, signalId, replyService);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
