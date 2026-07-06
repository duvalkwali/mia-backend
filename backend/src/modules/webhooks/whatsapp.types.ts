/**
 * Lightweight TypeScript mapping for Meta/WhatsApp webhook payloads.
 * Only the fields required by the MVP handlers are included here.
 *
 * Notes:
 * - The real payload from Meta contains richer structures; this type
 *   focuses on `entry[].changes[].value.messages[]` and contact metadata.
 * - Extend this interface if you add support for media messages, statuses,
 *   or message reactions in future iterations.
 */
export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          text: { body: string };
          type: string;
        }>;
      };
      field: string;
    }>;
  }>;
}
