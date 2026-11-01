import type { Db } from 'mongodb';
import { graphUrl, getLeadRetrievalToken, getMetaGraphApiVersion } from '@/lib/meta/config';
import { META_ADS_LEADS_COLLECTION } from '@/lib/ops/leads/adapters/meta-ads';
import { onNewLead } from '@/lib/leads/pipeline';

export const META_LEAD_ENRICH_JOBS = 'meta_lead_enrich_jobs';

const LEAD_FIELDS = [
  'field_data',
  'created_time',
  'ad_id',
  'ad_name',
  'adset_id',
  'adset_name',
  'campaign_id',
  'campaign_name',
  'form_id',
  'platform',
  'is_organic',
].join(',');

export type LeadgenValue = {
  leadgen_id?: string;
  page_id?: string;
  form_id?: string;
  ad_id?: string;
  adgroup_id?: string;
  created_time?: number;
};

export type EnrichedLead = {
  ok: boolean;
  name?: string;
  phone?: string;
  email?: string;
  campaignId?: string;
  campaignName?: string;
  adId?: string;
  adName?: string;
  adsetId?: string;
  adsetName?: string;
  formId?: string;
  platform?: string;
  fieldData?: Record<string, string>;
  error?: string;
};

export async function fetchLeadDetails(leadgenId: string): Promise<EnrichedLead> {
  const token = getLeadRetrievalToken();
  if (!token) return { ok: false, error: 'missing_lead_token' };
  const version = getMetaGraphApiVersion();
  void version;
  try {
    const url = graphUrl(`/${leadgenId}?fields=${LEAD_FIELDS}`, token);
    const response = await fetch(url);
    const data = (await response.json()) as {
      error?: { message?: string };
      field_data?: Array<{ name?: string; values?: string[] }>;
      ad_id?: string;
      ad_name?: string;
      adset_id?: string;
      adset_name?: string;
      campaign_id?: string;
      campaign_name?: string;
      form_id?: string;
      platform?: string;
    };
    if (!response.ok || data.error) {
      return { ok: false, error: data.error?.message || `HTTP ${response.status}` };
    }
    const fieldData: Record<string, string> = {};
    for (const field of data.field_data || []) {
      if (!field.name) continue;
      fieldData[field.name] = Array.isArray(field.values) ? String(field.values[0] || '') : '';
    }
    const phone = fieldData.phone_number || fieldData.phone || fieldData.mobile || fieldData.contact_number;
    const email = fieldData.email;
    const name = fieldData.full_name
      || [fieldData.first_name, fieldData.last_name].filter(Boolean).join(' ')
      || fieldData.name;
    return {
      ok: true,
      name: name || undefined,
      phone: phone || undefined,
      email: email || undefined,
      campaignId: data.campaign_id,
      campaignName: data.campaign_name,
      adId: data.ad_id,
      adName: data.ad_name,
      adsetId: data.adset_id,
      adsetName: data.adset_name,
      formId: data.form_id,
      platform: data.platform,
      fieldData,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'enrich_failed' };
  }
}

async function enqueueEnrich(db: Db, leadgenId: string, error: string) {
  const now = new Date().toISOString();
  await db.collection(META_LEAD_ENRICH_JOBS).updateOne(
    { leadgenId },
    {
      $set: {
        leadgenId,
        status: 'pending',
        lastError: error,
        nextAttemptAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        updatedAt: now,
      },
      $setOnInsert: { attempts: 0, createdAt: now },
    },
    { upsert: true },
  );
}

export async function upsertMetaLead(
  db: Db,
  input: { leadgenId: string; value: LeadgenValue; pageId?: string },
) {
  const existing = await db.collection(META_ADS_LEADS_COLLECTION).findOne({ id: input.leadgenId });
  if (existing && (existing as { status?: string }).status !== 'pending_enrich') {
    return { created: false, lead: existing, skipped: true as const };
  }

  const enriched = await fetchLeadDetails(input.leadgenId);
  const now = new Date().toISOString();
  const doc = {
    id: input.leadgenId,
    name: enriched.name,
    phone: enriched.phone,
    email: enriched.email,
    formId: input.value.form_id ? String(input.value.form_id) : enriched.formId,
    campaignId: enriched.campaignId,
    campaignName: enriched.campaignName,
    adId: input.value.ad_id ? String(input.value.ad_id) : enriched.adId,
    adName: enriched.adName,
    adsetId: enriched.adsetId,
    adsetName: enriched.adsetName,
    platform: enriched.platform || 'meta_lead_ads',
    fieldData: enriched.fieldData,
    status: enriched.ok ? 'new' : 'pending_enrich',
    pageId: input.value.page_id ? String(input.value.page_id) : input.pageId,
    rawWebhook: input.value,
    createdAt: input.value.created_time
      ? new Date(input.value.created_time * 1000).toISOString()
      : (existing as { createdAt?: string } | null)?.createdAt || now,
    updatedAt: now,
  };

  if (existing) {
    await db.collection(META_ADS_LEADS_COLLECTION).updateOne({ id: input.leadgenId }, { $set: doc });
  } else {
    try {
      await db.collection(META_ADS_LEADS_COLLECTION).insertOne(doc);
    } catch (error) {
      const code = (error as { code?: number }).code;
      if (code !== 11000) throw error;
    }
  }

  if (!enriched.ok) await enqueueEnrich(db, input.leadgenId, enriched.error || 'enrich_failed');
  else {
    await db.collection(META_LEAD_ENRICH_JOBS).updateOne(
      { leadgenId: input.leadgenId },
      { $set: { status: 'done', updatedAt: now } },
    );
  }

  if (enriched.ok || !existing) {
    await onNewLead({
      id: doc.id,
      source: 'meta_ads',
      name: doc.name,
      phone: doc.phone,
      email: doc.email,
      project: doc.adName || doc.campaignName || doc.formId,
      campaign: doc.campaignName,
      collection: META_ADS_LEADS_COLLECTION,
    }, db);
  }

  return { created: !existing, lead: doc, skipped: false as const, enriched: enriched.ok };
}

export async function processLeadgenPayload(db: Db, body: {
  entry?: Array<{ id?: string; changes?: Array<{ field?: string; value?: LeadgenValue }> }>;
}) {
  let accepted = 0;
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'leadgen' || !change.value?.leadgen_id) continue;
      await upsertMetaLead(db, {
        leadgenId: String(change.value.leadgen_id),
        value: change.value,
        pageId: entry.id,
      });
      accepted += 1;
    }
  }
  return { accepted };
}

export async function processLeadEnrichJobs(db: Db, limit = 10) {
  const now = new Date().toISOString();
  const jobs = await db.collection(META_LEAD_ENRICH_JOBS)
    .find({ status: 'pending', nextAttemptAt: { $lte: now } })
    .limit(limit)
    .toArray();
  let completed = 0;
  let failed = 0;
  for (const job of jobs) {
    const leadgenId = String((job as { leadgenId?: string }).leadgenId || '');
    if (!leadgenId) continue;
    const lead = await db.collection(META_ADS_LEADS_COLLECTION).findOne({ id: leadgenId });
    const value = ((lead as { rawWebhook?: LeadgenValue } | null)?.rawWebhook) || { leadgen_id: leadgenId };
    const result = await upsertMetaLead(db, { leadgenId, value, pageId: (lead as { pageId?: string } | null)?.pageId });
    if (result.enriched) completed += 1;
    else {
      failed += 1;
      const attempts = Number((job as { attempts?: number }).attempts || 0) + 1;
      await db.collection(META_LEAD_ENRICH_JOBS).updateOne(
        { leadgenId },
        {
          $set: {
            status: attempts >= 8 ? 'failed' : 'pending',
            attempts,
            nextAttemptAt: new Date(Date.now() + attempts * 10 * 60_000).toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      );
    }
  }
  return { processed: jobs.length, completed, failed };
}
