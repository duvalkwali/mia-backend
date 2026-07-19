import crypto from 'crypto';

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  const signatureBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);

  // timingSafeEqual throws RangeError on length mismatch — an attacker-supplied
  // malformed header must yield `false`, never crash the handler
  if (signatureBuf.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(signatureBuf, expectedBuf);
}

export function generateRandomToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}
