import { graphUrl } from '@/lib/meta/config';
import { getWhatsAppAccessToken, getWhatsAppWabaId } from '@/lib/whatsapp-cloud/config';

export type SendOverride = 'blocked' | 'unrestricted';

export type WabaHealthSnapshot = {
  accountReviewStatus: string | null;
  businessVerificationStatus: string | null;
  canSendMessage: string | null;
  phoneStatus: string | null;
  errors: string[];
};

const REVIEW_OK = new Set(['APPROVED']);
const VERIFY_OK = new Set(['verified']);
const SEND_OK = new Set(['AVAILABLE']);
const PHONE_BLOCKED = new Set(['RESTRICTED', 'BANNED', 'FLAGGED', 'DISCONNECTED']);

export const BUSINESS_VERIFICATION_REASON = 'Solution Provider will need to verify your business.';

/** Unset, blank, or any value other than unrestricted stays blocked. */
export function readSendOverride(raw: string | undefined = process.env.WHATSAPP_WABA_SEND_OVERRIDE): SendOverride {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'unrestricted' || value === 'allow') return 'unrestricted';
  return 'blocked';
}

type HealthError = { error_description?: string; possible_solution?: string };
type HealthEntity = { can_send_message?: string; errors?: HealthError[] };
type HealthStatus = { can_send_message?: string; entities?: HealthEntity[] };

export function parseWabaRestrictionPayload(payload: {
  account_review_status?: string;
  business_verification_status?: string;
  health_status?: HealthStatus;
  status?: string;
} | null | undefined): WabaHealthSnapshot {
  const errors: string[] = [];
  const health = payload?.health_status;
  for (const entity of health?.entities || []) {
    for (const error of entity.errors || []) {
      const description = String(error.error_description || error.possible_solution || '').trim();
      if (description) errors.push(description);
    }
    const entitySend = String(entity.can_send_message || '').toUpperCase();
    if (entitySend && !SEND_OK.has(entitySend)) {
      errors.push(`A WABA entity is ${entitySend}.`);
    }
  }
  return {
    accountReviewStatus: payload?.account_review_status ? String(payload.account_review_status) : null,
    businessVerificationStatus: payload?.business_verification_status ? String(payload.business_verification_status) : null,
    canSendMessage: health?.can_send_message ? String(health.can_send_message) : null,
    phoneStatus: payload?.status ? String(payload.status) : null,
    errors,
  };
}

export function graphRestrictionReasons(snapshot: WabaHealthSnapshot | null, graphError?: string | null): string[] {
  if (!snapshot) {
    return [graphError || 'Could not read the WABA restriction status from Meta.'];
  }
  const reasons: string[] = [];
  const review = String(snapshot.accountReviewStatus || '').toUpperCase();
  const verification = String(snapshot.businessVerificationStatus || '').toLowerCase();
  const canSend = String(snapshot.canSendMessage || '').toUpperCase();
  const phone = String(snapshot.phoneStatus || '').toUpperCase();
  if (!review || !REVIEW_OK.has(review)) {
    reasons.push(review ? `Account review status is ${review}.` : 'Account review status is missing.');
  }
  if (!verification || !VERIFY_OK.has(verification)) {
    reasons.push(BUSINESS_VERIFICATION_REASON);
  }
  if (!canSend || !SEND_OK.has(canSend)) {
    reasons.push(canSend ? `Meta health status is ${canSend}.` : 'Meta health status is missing.');
  }
  if (phone && PHONE_BLOCKED.has(phone)) reasons.push(`Phone status is ${phone}.`);
  for (const error of snapshot.errors) {
    if (!reasons.includes(error)) reasons.push(error);
  }
  return reasons;
}

export function evaluateWabaRestriction(input: {
  override: SendOverride;
  snapshot: WabaHealthSnapshot | null;
  graphError?: string | null;
}): {
  blocked: boolean;
  reason: string;
  override: SendOverride;
  graphRestricted: boolean;
  accountReviewStatus: string | null;
  businessVerificationStatus: string | null;
  canSendMessage: string | null;
} {
  const reasons = graphRestrictionReasons(input.snapshot, input.graphError);
  const graphRestricted = reasons.length > 0;
  const detail = reasons[0] || '';
  if (input.override !== 'unrestricted') {
    const reason = graphRestricted
      ? `Sending is blocked. ${detail} Set WHATSAPP_WABA_SEND_OVERRIDE=unrestricted only after Meta shows this WABA is unrestricted.`
      : 'Sending is blocked until WHATSAPP_WABA_SEND_OVERRIDE=unrestricted and Meta confirms this WABA is unrestricted.';
    return {
      blocked: true,
      reason,
      override: 'blocked',
      graphRestricted,
      accountReviewStatus: input.snapshot?.accountReviewStatus ?? null,
      businessVerificationStatus: input.snapshot?.businessVerificationStatus ?? null,
      canSendMessage: input.snapshot?.canSendMessage ?? null,
    };
  }
  if (graphRestricted) {
    return {
      blocked: true,
      reason: `Sending is blocked. ${detail}`,
      override: 'unrestricted',
      graphRestricted: true,
      accountReviewStatus: input.snapshot?.accountReviewStatus ?? null,
      businessVerificationStatus: input.snapshot?.businessVerificationStatus ?? null,
      canSendMessage: input.snapshot?.canSendMessage ?? null,
    };
  }
  return {
    blocked: false,
    reason: '',
    override: 'unrestricted',
    graphRestricted: false,
    accountReviewStatus: input.snapshot?.accountReviewStatus ?? null,
    businessVerificationStatus: input.snapshot?.businessVerificationStatus ?? null,
    canSendMessage: input.snapshot?.canSendMessage ?? null,
  };
}

export async function readWabaRestrictionFromGraph(fetchImpl: typeof fetch = fetch): Promise<{
  snapshot: WabaHealthSnapshot | null;
  error: string | null;
}> {
  const token = getWhatsAppAccessToken();
  const wabaId = getWhatsAppWabaId();
  if (!token) return { snapshot: null, error: 'WhatsApp access token is not configured.' };
  if (!wabaId) return { snapshot: null, error: 'WHATSAPP_WABA_ID is not configured.' };
  const path = `/${wabaId}?fields=account_review_status,business_verification_status,health_status,name`;
  try {
    const response = await fetchImpl(graphUrl(path, token));
    const body = await response.json().catch(() => ({})) as {
      error?: { message?: string };
      account_review_status?: string;
      business_verification_status?: string;
      health_status?: HealthStatus;
    };
    if (!response.ok || body.error) {
      return { snapshot: null, error: body.error?.message || `Meta Graph HTTP ${response.status}` };
    }
    return { snapshot: parseWabaRestrictionPayload(body), error: null };
  } catch (error) {
    return { snapshot: null, error: error instanceof Error ? error.message : 'Meta Graph request failed.' };
  }
}
