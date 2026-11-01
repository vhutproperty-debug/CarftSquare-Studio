import { getMetaSystemUserToken } from '@/lib/meta/config';

export function getWhatsAppPhoneNumberId(): string {
  return String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
}

export function getWhatsAppWabaId(): string {
  return String(process.env.WHATSAPP_WABA_ID || '').trim();
}

export function getWhatsAppAccessToken(): string {
  return String(process.env.WHATSAPP_ACCESS_TOKEN || '').trim() || getMetaSystemUserToken();
}

export function getWhatsAppVerifyToken(): string {
  return String(process.env.WHATSAPP_VERIFY_TOKEN || '').trim();
}

export function getWhatsAppDefaultLanguage(): string {
  return String(process.env.WHATSAPP_DEFAULT_LANG || 'en').trim() || 'en';
}

export function parseCsvList(raw: string | undefined): string[] {
  return String(raw || '')
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function getOwnerAlertWhatsApp(): string[] {
  return parseCsvList(process.env.OWNER_ALERT_WHATSAPP);
}

export function getOwnerAlertEmails(): string[] {
  return parseCsvList(process.env.OWNER_ALERT_EMAIL);
}

export type LeadAssignee = {
  id: string;
  name: string;
  email?: string;
};

export function getLeadAssignees(): LeadAssignee[] {
  const raw = process.env.LEAD_ASSIGNEES?.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as LeadAssignee[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row) => row && row.id && row.name);
  } catch {
    return [];
  }
}

/**
 * Sends are on when credentials exist, unless WHATSAPP_ENABLED=false.
 * WHATSAPP_ENABLED=true forces the flag even before a token is present (callers still no-op).
 */
export function isWhatsAppEnabled(): boolean {
  const flag = process.env.WHATSAPP_ENABLED?.trim();
  if (flag === 'false') return false;
  if (flag === 'true') return true;
  return Boolean(getWhatsAppPhoneNumberId() && getWhatsAppAccessToken());
}
