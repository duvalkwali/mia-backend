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
import { TenantContext } from '../../shared/types/common.types';
import { WhatsAppWebhookPayload } from './whatsapp.types';
import logger from '../../config/logger';

export class WhatsAppService {
  private replyService = new ReplyService();

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

    // Generate AI reply (does not send to WhatsApp yet)
    const reply = await this.replyService.generateReply(ctx, {
      contactId: message.from,
      incomingMessage: message.text.body,
    });

    // Return reply for controller to determine next action (manual approval, auto-send, etc.)
    return {
      processed: true,
      replyGenerated: reply,
    };
  }

  // Send a message back to a WhatsApp user using the Graph API
  // src/modules/webhooks/whatsapp.service.ts - Add this method:

async sendMessage(phoneNumber: string, message: string): Promise<void> {
  const url = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  
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
    throw new Error(`WhatsApp API error: ${await response.text()}`);
  }
}
}
