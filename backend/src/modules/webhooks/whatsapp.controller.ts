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
import logger from '../../config/logger';
import prisma from '@/config/database';
import redisClient from '@/config/redis';

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
    // Direct stdout — fires before Winston, before everything.
    console.log(`[WEBHOOK] POST received at ${new Date().toISOString()}`);
    try {
      // Log every incoming webhook so the operator can see traffic in the terminal
      const wamid: string | undefined = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id;
      const senderPhone: string | undefined = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;
      const phoneNumberId: string | undefined = req.body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
      const messageType: string | undefined = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.type;

      logger.info('━━ Webhook received ━━', {
        wamid,
        senderPhone,
        phoneNumberId,
        messageType,
        isMessageEvent: !!wamid,
        hasSignature: !!req.headers['x-hub-signature-256'],
      });

      // Verify signature header (x-hub-signature-256)
      const signature = req.headers['x-hub-signature-256'] as string;
      if (signature) {
        // Use rawBody if captured by middleware, fall back to re-serialised body
        const rawPayload: string = (req as any).rawBody ?? JSON.stringify(req.body);
        const isValid = verifyWebhookSignature(
          rawPayload,
          signature.replace('sha256=', ''),
          process.env.WHATSAPP_WEBHOOK_SECRET!
        );
        if (!isValid) {
          logger.warn('Webhook signature mismatch — continuing for dev/test');
        }
      } else {
        logger.warn('No x-hub-signature-256 header — skipping verification');
      }

      // Deduplication — Meta delivers with at-least-once guarantee.
      // Only message events carry a wamid; status updates don't, so we skip them.
      if (wamid) {
        const key = `wamid:${wamid}`;
        // SET NX returns null if key already exists (seen before), 'OK' if newly set
        const isNew = await redisClient.set(key, '1', { EX: 86400, NX: true });
        if (!isNew) {
          logger.info('Webhook: duplicate delivery — skipping', { wamid });
          res.sendStatus(200);
          return;
        }
        logger.info('Webhook: new message, proceeding', { wamid, senderPhone });
      } else {
        logger.info('Webhook: no wamid (likely a status update / read receipt) — skipping');
        res.sendStatus(200);
        return;
      }

      // Resolve tenantId from payload (mapping logic lives outside controller)
      const tenantId = await this.getTenantIdFromPhone(req.body);

      if (!tenantId) {
        logger.warn('Webhook: no tenant found — make sure a business profile is set up', { phoneNumberId });
        // Acknowledge to avoid retries; operator should investigate via logs
        res.sendStatus(200);
        return;
      }

      logger.info('Webhook: tenant resolved', { tenantId, phoneNumberId });

      const ctx = {
        tenantId,
        userId: '', // System user for webhooks
        role: 'SYSTEM',
      };

      // Respond 200 immediately — Meta requires a response within 20 s.
      // AI reply generation (Ollama) takes 30-120 s, so we fire-and-forget.
      res.sendStatus(200);

      logger.info('Webhook: starting background processing', { tenantId, wamid });

      const SETUP_TIPS: Record<string, string> = {
        BUSINESS_NOT_FOUND:       'Complete setup → Settings › Business',
        STYLE_PROFILE_NOT_FOUND:  'Complete setup → Settings › Style',
        NO_SIGNAL:                'Signal extraction failed — check signals service',
        AI_ERROR:                 'Ollama may not be running — run: ollama serve',
      };

      service.handleWebhook(ctx, req.body)
        .then((result) => logger.info('Webhook: processing complete', { tenantId, wamid, result }))
        .catch((err) => {
          const code = (err as any)?.code as string | undefined;
          logger.error('Webhook: processing failed', {
            tenantId,
            wamid,
            code: code ?? 'UNKNOWN',
            error: err?.message ?? String(err),
            ...(code && SETUP_TIPS[code] ? { tip: SETUP_TIPS[code] } : {}),
            stack: err?.stack,
          });
        });
    } catch (error) {
      logger.error('Webhook: controller error', {
        error: (error as Error)?.message,
        stack: (error as Error)?.stack,
      });
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
        // MVP: route to first tenant that has a business profile set up.
        // Production would map phoneNumberId → tenantId in a lookup table.
        status: { not: 'SUSPENDED' },
        business: { isNot: null },
      },
    });
    
    return tenant?.id || null;
  } catch (error) {
    logger.error('Failed to get tenant from phone', { error });
    return null;
  }
   
  }
}
