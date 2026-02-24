/**
 * WhatsApp Webhook Controller
 *
 * Exposes two handlers used by Meta's Webhooks API:
 * - `GET /webhook` for initial verification (challenge/verify_token)
 * - `POST /webhook` for incoming message events
 *
 * Responsibilities:
 * - Verify request authenticity (HMAC signature)
 * - Map incoming payload to a tenant context
 * - Forward validated events to the business logic in `WhatsAppService`
 *
 * Notes:
 * - The controller intentionally responds `200` on errors to avoid
 *   aggressive retries by Meta; non-delivery is surfaced via logs.
 */
import { Request, Response, NextFunction } from 'express';
import { WhatsAppService } from './whatsapp.service';
import { verifyWebhookSignature } from '../../shared/types/crypto';
import { AppError } from '../../middleware/errorHandler';
import logger from '../../config/logger';
import prisma from '@/config/database';

const service = new WhatsAppService();

export class WhatsAppController {
  /**
   * Webhook verification (GET request from Meta)
   * Responds with the challenge when verify token matches.
   */
  verifyWebhook(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      logger.info('Webhook verified');
      res.status(200).send(challenge);
    } else {
      res.status(403).send('Forbidden');
    }
  }

  /**
   * Webhook handler (POST request from Meta)
   * Steps:
   * 1. Verify HMAC signature to ensure payload integrity
   * 2. Resolve tenant context from payload (phone -> tenant)
   * 3. Forward payload to `WhatsAppService` for processing
   * 4. Always acknowledge with 200 to Meta to avoid repeated deliveries
   */
  async handleWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      // Verify signature header (x-hub-signature-256)
      const signature = req.headers['x-hub-signature-256'] as string;
      if (!signature) {
        throw new AppError(401, 'NO_SIGNATURE', 'Missing signature');
      }

      const isValid = verifyWebhookSignature(
        JSON.stringify(req.body),
        signature.replace('sha256=', ''),
        process.env.WHATSAPP_WEBHOOK_SECRET!
      );

      if (!isValid) {
        throw new AppError(401, 'INVALID_SIGNATURE', 'Invalid signature');
      }

      // Resolve tenantId from payload (mapping logic lives outside controller)
      const tenantId = await this.getTenantIdFromPhone(req.body);
      
      if (!tenantId) {
        logger.warn('No tenant found for webhook');
        // Acknowledge to avoid retries; operator should investigate via logs
        res.sendStatus(200);
        return;
      }

      const ctx = {
        tenantId,
        userId: '', // System user for webhooks
        role: 'SYSTEM',
      };

      // Forward to service layer which performs domain actions
      const result = await service.handleWebhook(ctx, req.body);

      logger.info('Webhook processed', { result });

      // Meta expects 200 to consider delivery successful
      res.sendStatus(200);
    } catch (error) {
      logger.error('Webhook error', { error });
      // Still respond 200 to prevent retries; inspect logs for details
      res.sendStatus(200);
    }
  }

  /**
   * Map webhook payload to a tenant identifier.
   * Implementation notes:
   * - In production this should perform a lookup (e.g. DB index on phone number)
   * - Could also support multi-tenant routing via phone_number_id metadata
   * - Returns `null` when no match is found so controller can safely ack
   */
  private async getTenantIdFromPhone(payload: any): Promise<string | null> {
    // Implementation would look up tenant by phone number
    // For MVP, could use a simple mapping table maintained by ops
    // TODO: Implement actual mapping in a future task

    try {
    const phoneNumberId = payload.entry[0].changes[0].value.metadata.phone_number_id;
    
    // Create a mapping table (for MVP - hardcode or use DB)
    const tenant = await prisma.tenant.findFirst({
      where: {
        // Option 1: Store WhatsApp phone number in tenant metadata
        // metadata: { contains: { whatsapp_phone_id: phoneNumberId } }
        
        // Option 2: For MVP - just use first active tenant
        status: 'ACTIVE',
      },
    });
    
    return tenant?.id || null;
  } catch (error) {
    logger.error('Failed to get tenant from phone', { error });
    return null;
  }
   
  }
}
