import type { Db } from 'mongodb';
import { getPhoneNumberStatus, WhatsAppApiError } from '@/lib/whatsapp-cloud/client';
import {
  getWhatsAppPhoneNumberId,
  getWhatsAppVerifyToken,
  getWhatsAppWabaId,
  isWhatsAppEnabled,
} from '@/lib/whatsapp-cloud/config';
import { getWhatsAppAccessToken } from '@/lib/whatsapp-cloud/config';
import { getWhatsAppSendDecision } from '@/lib/whatsapp-cloud/send-policy';
import { getWaTemplateCatalog, listStoredTemplates } from '@/lib/whatsapp-cloud/templates';
import { getLastWebhookReceivedAt } from '@/lib/whatsapp-cloud/webhook-store';
import { OPS_FOLLOW_UP_JOBS_COLLECTION } from '@/lib/ops/followups/store';

export async function buildWhatsAppHealth(db: Db) {
  let phone: Record<string, unknown> | null = null;
  let phoneError: string | null = null;
  if (getWhatsAppPhoneNumberId() && getWhatsAppAccessToken()) {
    try {
      phone = await getPhoneNumberStatus() as Record<string, unknown>;
    } catch (error) {
      phoneError = error instanceof WhatsAppApiError ? error.message : 'Phone status unavailable.';
    }
  }

  const templates = await listStoredTemplates(db);
  const catalog = templates.length
    ? templates.map((row) => ({
      name: String((row as { name?: string }).name || ''),
      label: String((row as { name?: string }).name || ''),
      languageCode: String((row as { language?: string }).language || ''),
      status: String((row as { status?: string }).status || ''),
      purpose: 'general',
      bodyVariableCount: 0,
    }))
    : getWaTemplateCatalog().map((row) => ({ ...row, status: 'not_synced' }));

  const followUpQueued = await db.collection(OPS_FOLLOW_UP_JOBS_COLLECTION).countDocuments({
    status: { $in: ['queued', 'retrying'] },
  });
  const decision = await getWhatsAppSendDecision(db);

  return {
    provider: 'whatsapp_cloud' as const,
    enabled: isWhatsAppEnabled(),
    phoneNumberId: getWhatsAppPhoneNumberId() || null,
    wabaId: getWhatsAppWabaId() || null,
    businessWaNumber: (phone?.display_phone_number as string | undefined) || getWhatsAppPhoneNumberId() || null,
    tokenConfigured: Boolean(getWhatsAppAccessToken()),
    verifyTokenConfigured: Boolean(getWhatsAppVerifyToken()),
    webhookSecretConfigured: Boolean(process.env.META_APP_SECRET?.trim()),
    webhookPath: '/api/webhooks/whatsapp',
    phone,
    phoneError,
    qualityRating: (phone?.quality_rating as string | undefined) || null,
    nameStatus: (phone?.name_status as string | undefined) || null,
    sendingPaused: decision.blocked,
    sendingLabel: decision.blocked ? 'Blocked' as const : 'Allowed' as const,
    sendBlockReason: decision.reason,
    wabaOverride: decision.override,
    wabaAccountReviewStatus: decision.accountReviewStatus,
    wabaBusinessVerificationStatus: decision.businessVerificationStatus,
    wabaCanSendMessage: decision.canSendMessage,
    templates: catalog,
    lastWebhookAt: await getLastWebhookReceivedAt(db),
    followUpQueued,
    sessionTextSupported: true,
  };
}
