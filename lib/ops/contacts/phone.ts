import { normalizeOutreachPhone } from '@/lib/ops/outreach-phone';

/** Canonical E.164 phone. Indian mobiles become +91 followed by 10 digits. */
export function normalizeContactPhone(value: unknown): string | null {
  const phone = normalizeOutreachPhone(value);
  if (!phone) return null;
  return phone.kind === 'indian' ? `+91${phone.phone}` : phone.phone;
}

/** Split a cell that may contain more than one number. Spaces stay inside a single number. */
export function splitPhones(value: unknown): string[] {
  const raw = String(value ?? '').trim();
  if (!raw) return [];
  const parts = raw.split(/[/|;,\n]+/).map((part) => part.trim()).filter(Boolean);
  const phones: string[] = [];
  for (const part of parts) {
    const phone = normalizeContactPhone(part);
    if (phone && !phones.includes(phone)) phones.push(phone);
  }
  return phones;
}
