/**
 * Canonical phone for owner outreach.
 * Indian mobiles stay as 10 national digits (existing ops_prospects shape).
 * Any other E.164 number is stored as "+<digits>" so it is not collapsed
 * into a look-alike Indian mobile (for example Singapore +65 9146 1314).
 */

export type OutreachPhoneKind = 'indian' | 'international';

export type NormalizedOutreachPhone = {
  /** Value stored on ops_prospects.phone */
  phone: string;
  /** Digits-only WhatsApp recipient (country code included, no plus). */
  waDigits: string;
  kind: OutreachPhoneKind;
};

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function indianNational(digits: string): string | null {
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]\d{9}$/.test(digits.slice(2))) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0') && /^[6-9]\d{9}$/.test(digits.slice(1))) {
    return digits.slice(1);
  }
  if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) return digits;
  return null;
}

export function normalizeOutreachPhone(value: unknown): NormalizedOutreachPhone | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const hasPlus = raw.startsWith('+');
  const digits = digitsOnly(raw);
  if (!digits || digits.length > 15) return null;

  if (hasPlus) {
    if (digits.startsWith('91')) {
      const national = indianNational(digits);
      if (national) {
        return { phone: national, waDigits: `91${national}`, kind: 'indian' };
      }
    }
    if (/^[1-9]\d{7,14}$/.test(digits)) {
      return { phone: `+${digits}`, waDigits: digits, kind: 'international' };
    }
    return null;
  }

  const national = indianNational(digits);
  if (
    national
    && (
      digits.length === 10
      || digits.length === 11
      || (digits.length === 12 && digits.startsWith('91'))
    )
  ) {
    return { phone: national, waDigits: `91${national}`, kind: 'indian' };
  }

  if (digits.length >= 11 && digits.length <= 15 && /^[1-9]\d{10,14}$/.test(digits)) {
    return { phone: `+${digits}`, waDigits: digits, kind: 'international' };
  }

  return null;
}

/** WhatsApp `from` is E.164 digits without a plus. Interpret it that way. */
export function phoneKeyFromWaId(waId: string | null | undefined): string {
  const digits = digitsOnly(String(waId || ''));
  if (!digits) return '';
  const outreach = normalizeOutreachPhone(`+${digits}`);
  return outreach?.phone || `invalid:${digits}`;
}

export function phoneLookupVariants(value: unknown): string[] {
  const normalized = normalizeOutreachPhone(value);
  if (!normalized) return [];
  if (normalized.kind === 'indian') {
    const national = normalized.phone;
    return [national, `91${national}`, `+91${national}`, `0${national}`];
  }
  return [normalized.phone, normalized.waDigits];
}

export function outreachPhonesEqual(left: unknown, right: unknown): boolean {
  const a = normalizeOutreachPhone(left);
  const b = normalizeOutreachPhone(right);
  return Boolean(a && b && a.phone === b.phone);
}
