import { createHmac, timingSafeEqual } from 'crypto';
import { getMetaAppSecret } from '@/lib/meta/config';

/**
 * Meta X-Hub-Signature-256.
 * Fail closed when the app secret is missing, including production.
 */
export function verifyXHubSignature256(
  rawBody: string | Buffer,
  signatureHeader: string | null | undefined,
  secret?: string,
): boolean {
  const key = (secret ?? getMetaAppSecret()).trim();
  if (!key) return false;
  if (!signatureHeader?.startsWith('sha256=')) return false;

  const body = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
  const expected = createHmac('sha256', key).update(body).digest('hex');
  const provided = signatureHeader.slice('sha256='.length).trim();
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(provided, 'hex');
    if (a.length !== b.length || a.length === 0) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function signXHubBody(rawBody: string, secret: string): string {
  const hash = createHmac('sha256', secret).update(Buffer.from(rawBody, 'utf8')).digest('hex');
  return `sha256=${hash}`;
}
