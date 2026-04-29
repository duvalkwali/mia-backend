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

    // Ignore non-message events early
    if (!value.messages || value.messages.length === 0) {
      logger.info('No messages in webhook payload');
      return { processed: false };
    }

    const message = value.messages[0];
    const contact = value.contacts?.[0];

    // Only handle plain text messages in MVP
    if (message.type !== 'text') {
      logger.info('Non-text message received', { type: message.type });
      return { processed: false };
    }

    logger.info('Processing WhatsApp message', {
      tenantId: ctx.tenantId,
      from: message.from,
      messageId: message.id,
    });

    // Generate AI reply
    const reply = await this.replyService.generateReply(ctx, {
      contactId: message.from,
      incomingMessage: message.text.body,
    });

    // If auto-reply is enabled, approve and send immediately — no dashboard step
    const autoReply = await this.businessService.isAutoReplyEnabled(ctx);
    if (autoReply && reply.replyId) {
      logger.info('Auto-reply enabled — sending immediately', { replyId: reply.replyId });
      try {
        await this.replyService.approveReply(ctx, reply.replyId);
      } catch (err: unknown) {
        logger.error('Auto-reply send failed', { replyId: reply.replyId, error: (err as Error)?.message });
      }
    }

    return {
      processed: true,
      replyGenerated: reply,
      autoReplySent: autoReply,
    };
  }

  // Send a message back to a WhatsApp user using the Graph API
  // src/modules/webhooks/whatsapp.service.ts - Add this method:

async sendMessage(phoneNumber: string, message: string): Promise<void> {
  const apiUrl = process.env.WHATSAPP_API_URL ?? 'https://graph.facebook.com/v18.0';
  const url = `${apiUrl}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
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
    logger.error('WhatsApp API rejected request', { status: response.status, body });
    throw new Error(`WhatsApp API error ${response.status}: ${body}`);
  }
}
}
