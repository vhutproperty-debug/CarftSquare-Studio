import { isValidIndianMobile, normalizeIndianMobile } from '@/lib/phone/indian-mobile';

export function buildTelLink(phone: string | null | undefined): string | null {
  const normalized = normalizeIndianMobile(phone);
  if (!isValidIndianMobile(normalized)) return null;
  return `tel:+91${normalized}`;
}

export function buildWhatsAppLink(
  phone: string | null | undefined,
  message?: string,
): string | null {
  const normalized = normalizeIndianMobile(phone);
  if (!isValidIndianMobile(normalized)) return null;
  const base = `https://wa.me/91${normalized}`;
  if (message?.trim()) {
    return `${base}?text=${encodeURIComponent(message.trim())}`;
  }
  return base;
}

export function formatPhoneDisplay(phone: string | null | undefined): string {
  const normalized = normalizeIndianMobile(phone);
  if (!normalized) return phone?.trim() || '—';
  if (normalized.length === 10) {
    return `+91 ${normalized.slice(0, 5)} ${normalized.slice(5)}`;
  }
  return normalized;
}
