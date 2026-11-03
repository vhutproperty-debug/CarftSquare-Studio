import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { META_ADS_LEADS_COLLECTION } from '@/lib/ops/leads/adapters/meta-ads';
import { stampCreate } from '@/lib/ops/os/records';
import { growthModuleEnabled } from '@/lib/ops/os/flags';
import { getWhatsAppSendDecision } from '@/lib/whatsapp-cloud/send-policy';
import {
  extractLeadgenNotices,
  extractWhatsAppEnquiries,
  leadsRetrievalGranted,
  whatsAppCaptureAllowed,
  type LeadgenNotice,
} from '@/lib/ops/growth/capture/parse';

export const GROWTH_CAPTURE_COLLECTION = 'ops_growth_inbox_events';

export type GrowthCapture = {
  id: string;
  source: 'meta_instant_form' | 'whatsapp_cloud';
  externalId: string;
  idempotencyKey: string;
  name: string;
  phone: string;
  message: string;
  campaignId: string;
  adId: string;
  formId: string;
  answers: Record<string, string>;
  status: 'captured' | 'awaiting_permission' | 'restricted';
  at: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CaptureInput = {
  source: GrowthCapture['source'];
  externalId: string;
  name?: string;
  phone?: string;
  message?: string;
  campaignId?: string;
  adId?: string;
  formId?: string;
  answers?: Record<string, string>;
  status: GrowthCapture['status'];
  at?: string;
};

let indexesReady = false;

async function ensureIndexes(db: Db): Promise<void> {
  if (indexesReady) return;
  await db.collection(GROWTH_CAPTURE_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(GROWTH_CAPTURE_COLLECTION).createIndex({ idempotencyKey: 1 }, { unique: true });
  indexesReady = true;
}

function keyFor(source: string, externalId: string): string {
  return `${source}:${externalId}`;
}

export async function listGrowthCaptures(db: Db): Promise<GrowthCapture[]> {
  await ensureIndexes(db);
  const rows = await db.collection(GROWTH_CAPTURE_COLLECTION).find({}).sort({ at: -1 }).toArray();
  return (rows as unknown as GrowthCapture[]).filter((row) => !row.deletedAt);
}

/** Inserts one inbox event. A repeat of the same external id does not rewrite other rows. */
export async function captureGrowthLead(db: Db, input: CaptureInput, actorId = 'system'): Promise<{ created: boolean; event: GrowthCapture }> {
  await ensureIndexes(db);
  const idempotencyKey = keyFor(input.source, input.externalId);
  const existing = await db.collection(GROWTH_CAPTURE_COLLECTION).findOne({ idempotencyKey }) as unknown as GrowthCapture | null;
  if (existing) {
    const canFill = existing.status === 'awaiting_permission' && input.status === 'captured';
    if (!canFill) return { created: false, event: existing };
    const next: GrowthCapture = {
      ...existing,
      name: input.name || existing.name,
      phone: input.phone || existing.phone,
      message: input.message || existing.message,
      campaignId: input.campaignId || existing.campaignId,
      adId: input.adId || existing.adId,
      formId: input.formId || existing.formId,
      answers: input.answers || existing.answers,
      status: 'captured',
      updatedAt: new Date().toISOString(),
      updatedBy: actorId,
    };
    const stored = { ...next } as GrowthCapture & { _id?: unknown };
    delete stored._id;
    await db.collection(GROWTH_CAPTURE_COLLECTION).updateOne({ idempotencyKey }, { $set: stored });
    return { created: false, event: next };
  }
  const doc: GrowthCapture = {
    id: uuidv4(),
    source: input.source,
    externalId: input.externalId,
    idempotencyKey,
    name: input.name || '',
    phone: input.phone || '',
    message: input.message || '',
    campaignId: input.campaignId || '',
    adId: input.adId || '',
    formId: input.formId || '',
    answers: input.answers || {},
    status: input.status,
    at: input.at || new Date().toISOString(),
    ...stampCreate({ id: actorId }),
  };
  try {
    await db.collection(GROWTH_CAPTURE_COLLECTION).insertOne({ ...doc });
    return { created: true, event: doc };
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 11000) throw error;
    const raced = await db.collection(GROWTH_CAPTURE_COLLECTION).findOne({ idempotencyKey }) as unknown as GrowthCapture | null;
    if (!raced) throw error;
    return { created: false, event: raced };
  }
}

export async function captureMetaNotice(
  db: Db,
  notice: LeadgenNotice,
  lead: {
    name?: string;
    phone?: string;
    campaignId?: string;
    adId?: string;
    formId?: string;
    fieldData?: Record<string, string>;
    status?: string;
  } | null,
): Promise<{ created: boolean; event: GrowthCapture }> {
  const awaiting = !lead || lead.status === 'pending_enrich' || !lead.fieldData;
  return captureGrowthLead(db, {
    source: 'meta_instant_form',
    externalId: notice.leadgenId,
    name: awaiting ? '' : lead?.name || '',
    phone: awaiting ? '' : lead?.phone || '',
    campaignId: lead?.campaignId || '',
    adId: notice.adId || lead?.adId || '',
    formId: notice.formId || lead?.formId || '',
    answers: awaiting ? {} : lead?.fieldData || {},
    status: awaiting ? 'awaiting_permission' : 'captured',
    at: notice.createdTime,
  });
}

export async function captureMetaWebhook(db: Db, body: unknown): Promise<{ accepted: number }> {
  if (!growthModuleEnabled('LEAD_CAPTURE')) return { accepted: 0 };
  const notices = extractLeadgenNotices(body);
  let accepted = 0;
  for (const notice of notices) {
    const lead = await db.collection(META_ADS_LEADS_COLLECTION).findOne({ id: notice.leadgenId }) as {
      name?: string;
      phone?: string;
      campaignId?: string;
      adId?: string;
      formId?: string;
      fieldData?: Record<string, string>;
      status?: string;
    } | null;
    const result = await captureMetaNotice(db, notice, lead);
    if (result.created) accepted += 1;
  }
  return { accepted };
}

export async function captureWhatsAppEnquiries(db: Db, body: unknown, restricted: boolean): Promise<{ accepted: number; restricted: boolean }> {
  const gate = whatsAppCaptureAllowed(restricted);
  if (!gate.allowed) return { accepted: 0, restricted: true };
  let accepted = 0;
  for (const enquiry of extractWhatsAppEnquiries(body)) {
    const result = await captureGrowthLead(db, {
      source: 'whatsapp_cloud',
      externalId: enquiry.externalId,
      name: enquiry.name,
      phone: enquiry.phone,
      message: enquiry.message,
      status: 'captured',
      at: enquiry.at,
    });
    if (result.created) accepted += 1;
  }
  return { accepted, restricted: false };
}

export async function captureWhatsAppWebhook(db: Db, body: unknown): Promise<{ accepted: number; restricted: boolean }> {
  if (!growthModuleEnabled('LEAD_CAPTURE')) return { accepted: 0, restricted: false };
  const decision = await getWhatsAppSendDecision(db);
  return captureWhatsAppEnquiries(db, body, decision.blocked);
}

export async function fetchMetaLeadIntoInbox(
  db: Db,
  input: { leadgenId: string; permissions: string[]; fetchLead: (id: string) => Promise<{ ok: boolean; name?: string; phone?: string; campaignId?: string; adId?: string; formId?: string; fieldData?: Record<string, string>; error?: string }> },
): Promise<{ event: GrowthCapture; fetched: boolean }> {
  if (!leadsRetrievalGranted(input.permissions)) {
    const result = await captureGrowthLead(db, {
      source: 'meta_instant_form',
      externalId: input.leadgenId,
      status: 'awaiting_permission',
      answers: {},
    });
    return { event: result.event, fetched: false };
  }
  const details = await input.fetchLead(input.leadgenId);
  const result = await captureGrowthLead(db, {
    source: 'meta_instant_form',
    externalId: input.leadgenId,
    name: details.ok ? details.name : '',
    phone: details.ok ? details.phone : '',
    campaignId: details.campaignId,
    adId: details.adId,
    formId: details.formId,
    answers: details.ok ? details.fieldData || {} : {},
    status: details.ok ? 'captured' : 'awaiting_permission',
  });
  return { event: result.event, fetched: details.ok };
}

export async function getGrowthCaptureDb(): Promise<Db> {
  return getDb();
}
