import { isValidIndianMobile, normalizeIndianMobile } from '@/lib/phone/indian-mobile';
import { normalizeOutreachPhone } from '@/lib/ops/outreach-phone';

export function buildTelLink(phone: string | null | undefined): string | null {
  const outreach = normalizeOutreachPhone(phone);
  if (!outreach) return null;
  return outreach.kind === 'indian' ? `tel:+91${outreach.phone}` : `tel:${outreach.phone}`;
}

export function buildWhatsAppLink(
  phone: string | null | undefined,
  message?: string,
): string | null {
  const outreach = normalizeOutreachPhone(phone);
  if (!outreach) return null;
  const base = `https://wa.me/${outreach.waDigits}`;
  if (message?.trim()) {
    return `${base}?text=${encodeURIComponent(message.trim())}`;
  }
  return base;
}

export function formatPhoneDisplay(phone: string | null | undefined): string {
  const raw = phone?.trim() || '';
  if (raw.startsWith('+')) {
    const outreach = normalizeOutreachPhone(raw);
    if (outreach?.kind === 'indian') {
      return `+91 ${outreach.phone.slice(0, 5)} ${outreach.phone.slice(5)}`;
    }
    if (outreach) return outreach.phone;
  }
  const normalized = normalizeIndianMobile(phone);
  if (!normalized) return raw || '—';
  if (isValidIndianMobile(normalized)) {
    return `+91 ${normalized.slice(0, 5)} ${normalized.slice(5)}`;
  }
  return raw || normalized;
}
