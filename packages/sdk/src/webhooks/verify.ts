import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verifies a webhook signature.
 * Use this in your webhook handler to validate that the payload
 * came from Agent Identity and was not tampered with.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  if (!signature.startsWith('sha256=')) return false;
  const expected = 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
