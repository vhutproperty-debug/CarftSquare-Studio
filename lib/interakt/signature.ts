import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Interakt webhook authentication (official docs):
 * Header: Interakt-Signature
 * Value: "sha256=" + hex(HMAC-SHA256(secret_key, raw_request_body))
 * Source: https://www.interakt.shop/resource-center/interakts-webhooks/
 */
export function generateInteraktSignature(secretKey: string, payload: string | Buffer): string {
  const body = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : payload;
  const hash = createHmac('sha256', secretKey).update(body).digest('hex');
  return `sha256=${hash}`;
}

export function verifyInteraktSignature(
  secretKey: string,
  payload: string | Buffer,
  signatureHeader: string | null | undefined,
): boolean {
  if (!secretKey || !signatureHeader) return false;

  const expected = generateInteraktSignature(secretKey, payload);
  const received = signatureHeader.trim();

  const expectedBuf = Buffer.from(expected, 'utf8');
  const receivedBuf = Buffer.from(received, 'utf8');
  if (expectedBuf.length !== receivedBuf.length) return false;

  try {
    return timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}
