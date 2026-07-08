/**
 * WhatsAppService
 *
 * Domain service responsible for transforming incoming WhatsApp webhook
 * payloads into domain actions. Current MVP responsibilities:
 * - Validate payload shape
 * - Filter to supported message types (text)
 * - Invoke `ReplyService.generateReply` to produce an AI reply
 * - Return a lightweight processing result for controller logging
 *
 * Notes on evolution:
 * - Auto-send logic (posting replies back to WhatsApp) can be added here
 * - A delivery queue / rate limiter belongs at this level
 */
import { ReplyService } from '../ai-reply/reply.service';
import { BusinessService } from '../business/business.service';
import { TenantContext } from '../../shared/types/common.types';
import { WhatsAppWebhookPayload } from './whatsapp.types';
import prisma from '@/config/database';
import logger from '../../config/logger';

export class WhatsAppService {
  private replyService = new ReplyService();
  private businessService = new BusinessService();

  /**
   * Handle an incoming webhook payload.
   * Returns `{ processed: boolean, replyGenerated?: ... }` for controller consumption.
   */
  async handleWebhook(ctx: TenantContext, payload: WhatsAppWebhookPayload) {
    const entry = payload.entry[0];
    const change = entry.changes[0];
    const value = change.value;

    // Ignore non-message events (delivery receipts, read receipts, etc.)
    if (!value.messages || value.messages.length === 0) {
      logger.info('WhatsApp: no user messages in payload (status update?)', { tenantId: ctx.tenantId });
      return { processed: false };
    }

    const message = value.messages[0];
    const contact = value.contacts?.[0];

    // Only handle plain text messages in MVP
    if (message.type !== 'text') {
      logger.info('WhatsApp: non-text message — skipping', {
        tenantId: ctx.tenantId,
        from: message.from,
        type: message.type,
      });
      return { processed: false };
    }

    logger.info('WhatsApp: incoming text message', {
      tenantId: ctx.tenantId,
      from: message.from,
      messageId: message.id,
      contactName: contact?.profile?.name ?? 'unknown',
      textLength: message.text.body.length,
    });

    // Generate AI reply (signal extraction happens inside)
    logger.info('WhatsApp: starting signal extraction + reply generation', { tenantId: ctx.tenantId });
    const reply = await this.replyService.generateReply(ctx, {
      contactId: message.from,
      incomingMessage: message.text.body,
    });

    logger.info('WhatsApp: reply generated — queued for review', {
      tenantId: ctx.tenantId,
      replyId: reply.replyId,
      confidence: reply.confidence,
      status: reply.status,
    });

    // If auto-reply is enabled, approve and send immediately — no dashboard step
    const autoReply = await this.businessService.isAutoReplyEnabled(ctx);
    logger.info('WhatsApp: auto-reply setting', { tenantId: ctx.tenantId, autoReply });

    if (autoReply && reply.replyId) {
      logger.info('WhatsApp: auto-reply ON — approving and sending immediately', { replyId: reply.replyId });
      try {
        await this.replyService.approveReply(ctx, reply.replyId);
        logger.info('WhatsApp: auto-reply sent successfully', { replyId: reply.replyId, to: message.from });
      } catch (err: unknown) {
        logger.error('WhatsApp: auto-reply send failed', { replyId: reply.replyId, error: (err as Error)?.message });
      }
    } else {
      logger.info('WhatsApp: auto-reply OFF — reply is PENDING in dashboard', {
        tenantId: ctx.tenantId,
        replyId: reply.replyId,
      });
    }

    return {
      processed: true,
      replyGenerated: reply,
      autoReplySent: autoReply,
    };
  }

  /**
   * Send a message back to a WhatsApp user using the Graph API.
   *
   * Credentials are resolved per tenant (Tenant.whatsappPhoneNumberId /
   * whatsappAccessToken), falling back to the WHATSAPP_* env vars so the
   * single-tenant pilot keeps working before onboarding UI exists.
   */
  async sendMessage(ctx: TenantContext, phoneNumber: string, message: string): Promise<void> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { whatsappPhoneNumberId: true, whatsappAccessToken: true },
    });

    const phoneNumberId = tenant?.whatsappPhoneNumberId ?? process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = tenant?.whatsappAccessToken ?? process.env.WHATSAPP_ACCESS_TOKEN;

    if (!phoneNumberId || !accessToken) {
      throw new Error(
        'WhatsApp credentials missing: set Tenant.whatsappPhoneNumberId/whatsappAccessToken ' +
        'or the WHATSAPP_PHONE_NUMBER_ID/WHATSAPP_ACCESS_TOKEN env vars'
      );
    }

    const apiUrl = process.env.WHATSAPP_API_URL ?? 'https://graph.facebook.com/v18.0';
    const url = `${apiUrl}/${phoneNumberId}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'text',
        text: { body: message },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      logger.error('WhatsApp API rejected request', { status: response.status, body, tenantId: ctx.tenantId });
      throw new Error(`WhatsApp API error ${response.status}: ${body}`);
    }
  }
}
