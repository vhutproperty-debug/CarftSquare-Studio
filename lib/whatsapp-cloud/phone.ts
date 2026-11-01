import { createHash } from 'crypto';
import { isValidIndianMobile, normalizeIndianMobile } from '@/lib/phone/indian-mobile';
import { phoneLookupVariants } from '@/lib/ops/outreach-phone';
import { getWhatsAppPhoneNumberId } from '@/lib/whatsapp-cloud/config';

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

/**
 * Digits-only E.164 without a leading plus. Indian mobiles become 91XXXXXXXXXX.
 * A leading + means the value is already E.164 (do not treat +65… as an Indian mobile).
 */
export function toWhatsAppRecipient(raw: string | null | undefined): string {
  const trimmed = String(raw || '').trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  if (trimmed.startsWith('+')) return digits;
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) {
    const national = digits.slice(1);
    return /^[6-9]/.test(national) ? `91${national}` : digits;
  }
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return digits;
}

export function toWaE164Digits(raw: string | null | undefined): string {
  return toWhatsAppRecipient(raw);
}

export function phoneStorageVariants(normalizedPhone: string): string[] {
  const variants = phoneLookupVariants(normalizedPhone);
  if (variants.length) return variants;
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
  if (params.providerMessageId) {
    return `${params.eventType}:${params.providerMessageId}`;
  }
  return params.payloadHash;
}

/** Stable line key stored on conversations. Empty when the phone number id is unset. */
export function getWaBusinessWaNumber(): string {
  return getWhatsAppPhoneNumberId().replace(/\D/g, '');
}
