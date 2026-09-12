import { createHash } from 'crypto';
import { isValidIndianMobile, normalizeIndianMobile } from '@/lib/phone/indian-mobile';

/** Legacy CraftSquare marketing WhatsApp — must never be the Interakt production line. */
export const LEGACY_MARKETING_WA_NUMBER = '917304242604';

/** Locked production Interakt business WhatsApp (E.164 digits). */
export const INTERAKT_PRODUCTION_WA_NUMBER = '919867525258';

export function getInteraktBusinessWaNumber(): string {
  const value = String(process.env.INTERAKT_BUSINESS_WA_NUMBER || '').replace(/\D/g, '');
  if (value === LEGACY_MARKETING_WA_NUMBER) {
    throw new Error(
      'INTERAKT_BUSINESS_WA_NUMBER is set to the legacy marketing number. Use 919867525258.',
    );
  }
  return value;
}

export function maskPhoneForLog(phone: string | null | undefined): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return 'unknown';
  if (digits.length <= 4) return `****${digits}`;
  return `****${digits.slice(-4)}`;
}

/** Canonical 10-digit Indian mobile, or empty if invalid. */
export function toNormalizedIndianPhone(raw: string | null | undefined): string {
  const normalized = normalizeIndianMobile(raw);
  return isValidIndianMobile(normalized) ? normalized : '';
}

/** Digits-only E.164-ish WhatsApp id (often 91XXXXXXXXXX). */
export function toWaE164Digits(raw: string | null | undefined): string {
  return String(raw || '').replace(/\D/g, '');
}

export function phoneStorageVariants(normalizedPhone: string): string[] {
  const n = normalizeIndianMobile(normalizedPhone);
  if (!n) return [];
  return Array.from(new Set([n, `91${n}`, `+91${n}`, `0${n}`]));
}

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function buildProviderEventKey(params: {
  payloadHash: string;
  eventType: string;
  providerMessageId: string | null;
  webhookTimestamp: string | null;
}): string {
  // Prefer full payload hash so identical retries collide even without message id.
  return params.payloadHash;
}
