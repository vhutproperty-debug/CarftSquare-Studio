import { isBrokerRole } from '@/lib/auth/rbac/roles';
import type { AccessActor } from '@/lib/ops/os/permissions';

/**
 * Fields an external broker must never receive.
 * Enforced on API payloads, not only in the UI.
 */
const DENY_KEYS = new Set([
  'owner',
  'ownerName',
  'ownerPhone',
  'ownerMobile',
  'ownerEmail',
  'ownerWhatsapp',
  'phone',
  'phones',
  'phonesTel',
  'email',
  'whatsapp',
  'normalizedPhone',
  'normalizedEmail',
  'normalizedOwnerMobile',
  'normalizedOwnerEmail',
  'flat',
  'flatNumber',
  'unitNumber',
  'floor',
  'wing',
  'negotiationNotes',
  'internalNotes',
  'offerAmount',
  'offerTag',
  'askingPriceCrore',
  'askingPriceLabel',
  'expectedBrokerage',
  'actualBrokerage',
  'brokeragePercent',
  'commissionCollected',
  'brokerage',
  'internalBrokerage',
  'pricePerSqft',
  'pricePerSqftMax',
  'offerNote',
  'salesPhone',
  'salesEmail',
  'cpEmail',
  'contacts',
  'clientName',
  'clientPhone',
  'clientEmail',
  'clientKyc',
  'builderCommercials',
  'expectedRevenue',
  'collectedRevenue',
  'pendingBrokerage',
  'expectedAmount',
  'collectedAmount',
  'invoicedAmount',
  'pendingAmount',
]);

const SENSITIVE_KEY = /(phone|email|whatsapp|flatnumber|unitnumber|brokerage|negotiation)/i;
const TEXT_KEYS = new Set(['notes', 'intent', 'response', 'nextAction', 'message', 'note']);
const PHONE_OR_EMAIL = /(?:\+?\d[\d\s-]{8,}\d)|(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;

export function scrubPrivateText(value: string): string {
  return value.replace(PHONE_OR_EMAIL, '[redacted]');
}

function denyKey(key: string): boolean {
  if (DENY_KEYS.has(key)) return true;
  if (key === 'broker' || key === 'brokerName' || key === 'brokerId') return false;
  return SENSITIVE_KEY.test(key);
}

function redactValue(value: unknown, parentKey?: string): unknown {
  if (Array.isArray(value)) return value.map((item) => redactValue(item, parentKey));
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && parentKey && TEXT_KEYS.has(parentKey)) return scrubPrivateText(value);
    return value;
  }
  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(source)) {
    if (denyKey(key)) continue;
    out[key] = redactValue(child, key);
  }
  if ('phones' in source || parentKey === 'contacts' || parentKey === 'owner') {
    delete out.name;
    delete out.email;
  }
  return out;
}

export function redactBrokerPayload<T>(payload: T): T {
  return redactValue(payload) as T;
}

export function presentForActor<T>(actor: AccessActor, payload: T): T {
  if (!actor || actor.via === 'token') return payload;
  if (!isBrokerRole(actor)) return payload;
  return redactBrokerPayload(payload);
}

export function payloadLeaksBrokerSecrets(value: unknown): boolean {
  const json = JSON.stringify(value);
  return /ownerPhone|ownerName|flatNumber|unitNumber|"phones"|negotiationNotes|expectedBrokerage|pricePerSqft|clientPhone|whatsapp/i.test(json);
}
