import { createHash } from 'crypto';
import type { MetaHashedUserData, MetaRawUserData } from './types';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  return normalized.includes('@') ? normalized : null;
}

function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function normalizeName(value: string): string | null {
  const normalized = value.trim().toLowerCase().replace(/[^a-z]/g, '');
  return normalized || null;
}

export function hashUserData(
  raw: MetaRawUserData | undefined,
  requestMeta?: { clientIpAddress?: string; clientUserAgent?: string },
): MetaHashedUserData {
  const hashed: MetaHashedUserData = {};

  if (raw?.email) {
    const email = normalizeEmail(raw.email);
    if (email) hashed.em = [sha256(email)];
  }

  if (raw?.phone) {
    const phone = normalizePhone(raw.phone);
    if (phone) hashed.ph = [sha256(phone)];
  }

  if (raw?.firstName) {
    const firstName = normalizeName(raw.firstName);
    if (firstName) hashed.fn = [sha256(firstName)];
  }

  if (raw?.lastName) {
    const lastName = normalizeName(raw.lastName);
    if (lastName) hashed.ln = [sha256(lastName)];
  }

  if (raw?.fbp) hashed.fbp = raw.fbp;
  if (raw?.fbc) hashed.fbc = raw.fbc;
  if (requestMeta?.clientIpAddress) hashed.client_ip_address = requestMeta.clientIpAddress;
  if (requestMeta?.clientUserAgent) hashed.client_user_agent = requestMeta.clientUserAgent;

  return hashed;
}

export function splitFullName(fullName: string): { firstName?: string; lastName?: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return {};
  if (parts.length === 1) return { firstName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}
