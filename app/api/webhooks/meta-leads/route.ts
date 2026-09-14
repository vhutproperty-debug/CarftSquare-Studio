import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { getDb } from '@/lib/mongodb';
import {
  META_ADS_LEADS_COLLECTION,
  ensureMetaAdsLeadIndexes,
} from '@/lib/ops/leads/adapters/meta-ads';
import { sendMetaConversionEvent } from '@/lib/meta-capi/server';
import { normalizeIndianMobile, isValidIndianMobile } from '@/lib/phone/indian-mobile';

export const runtime = 'nodejs';

/**
 * Meta Lead Ads webhook.
 * Configure in Meta App → Webhooks → Page subscribed to leadgen.
 * Verify token must match META_LEAD_ADS_VERIFY_TOKEN.
 * Optional signature: META_APP_SECRET → X-Hub-Signature-256.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  const expected = process.env.META_LEAD_ADS_VERIFY_TOKEN?.trim();

  if (mode === 'subscribe' && expected && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'Verification failed.' }, { status: 403 });
}

type LeadgenChange = {
  field?: string;
  value?: {
    leadgen_id?: string;
    page_id?: string;
    form_id?: string;
    ad_id?: string;
    adgroup_id?: string;
    created_time?: number;
  };
};

function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.META_APP_SECRET?.trim();
  if (!secret) {
    // Signature optional until META_APP_SECRET is configured.
    return true;
  }
  if (!signatureHeader?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const provided = signatureHeader.slice('sha256='.length);
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(provided, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256');
  if (!verifyMetaSignature(rawBody, signature)) {
    console.warn('[meta-leads] signature_invalid');
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
  }

  let body: {
    object?: string;
    entry?: Array<{ id?: string; changes?: LeadgenChange[] }>;
  };

  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  try {
    const db = await getDb();
    await ensureMetaAdsLeadIndexes(db);

    const entries = body.entry || [];
    let accepted = 0;

    for (const entry of entries) {
      for (const change of entry.changes || []) {
        if (change.field !== 'leadgen' || !change.value?.leadgen_id) continue;
        const leadgenId = String(change.value.leadgen_id);
        const existing = await db.collection(META_ADS_LEADS_COLLECTION).findOne({ id: leadgenId });
        if (existing) {
          accepted += 1;
          continue;
        }

        const enriched = await fetchLeadDetails(leadgenId);
        const now = new Date().toISOString();
        const doc = {
          id: leadgenId,
          name: enriched.name || undefined,
          phone: enriched.phone || undefined,
          email: enriched.email || undefined,
          formId: change.value.form_id ? String(change.value.form_id) : undefined,
          campaignId: enriched.campaignId,
          campaignName: enriched.campaignName,
          adId: change.value.ad_id ? String(change.value.ad_id) : undefined,
          adName: enriched.adName,
          platform: 'meta_lead_ads',
          fieldData: enriched.fieldData,
          status: 'new',
          pageId: change.value.page_id ? String(change.value.page_id) : entry.id,
          rawWebhook: change.value,
          createdAt: change.value.created_time
            ? new Date(change.value.created_time * 1000).toISOString()
            : now,
          updatedAt: now,
        };

        try {
          await db.collection(META_ADS_LEADS_COLLECTION).insertOne(doc);
          accepted += 1;
          console.info(
            '[meta-leads] lead_accepted',
            JSON.stringify({ leadgenId, hasPhone: Boolean(doc.phone), formId: doc.formId }),
          );

          waitUntil(
            sendMetaLeadConversion({
              leadgenId,
              phone: doc.phone,
              email: doc.email,
              name: doc.name,
              formId: doc.formId,
              campaignId: doc.campaignId,
            }).catch((error) => {
              console.warn(
                '[meta-leads] capi_failed',
                error instanceof Error ? error.message : error,
              );
            }),
          );
        } catch (error) {
          const code = (error as { code?: number }).code;
          if (code === 11000) accepted += 1;
          else throw error;
        }
      }
    }

    return NextResponse.json({ ok: true, accepted });
  } catch (error) {
    console.error('[meta-leads] webhook_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to process lead webhook.' }, { status: 500 });
  }
}

async function sendMetaLeadConversion(input: {
  leadgenId: string;
  phone?: string;
  email?: string;
  name?: string;
  formId?: string;
  campaignId?: string;
}) {
  const phone = normalizeIndianMobile(input.phone);
  const [firstName, ...rest] = (input.name || '').trim().split(/\s+/);
  return sendMetaConversionEvent({
    eventName: 'Lead',
    eventId: `meta-leadads:${input.leadgenId}`,
    eventSourceUrl: 'https://craftsquare.co.in/ops/leads',
    userData: {
      phone: isValidIndianMobile(phone) ? phone : undefined,
      email: input.email,
      firstName: firstName || undefined,
      lastName: rest.length ? rest.join(' ') : undefined,
    },
    customData: {
      content_name: 'meta_lead_ads',
      form_id: input.formId,
      campaign_id: input.campaignId,
      lead_event_source: 'Meta Lead Ads Webhook',
    },
  });
}

async function fetchLeadDetails(leadgenId: string): Promise<{
  name?: string;
  phone?: string;
  email?: string;
  campaignId?: string;
  campaignName?: string;
  adName?: string;
  fieldData?: Record<string, string>;
}> {
  const token = process.env.META_ACCESS_TOKEN?.trim() || process.env.META_LEAD_ADS_PAGE_TOKEN?.trim();
  if (!token) {
    return {};
  }

  try {
    const url = `https://graph.facebook.com/v19.0/${leadgenId}?access_token=${encodeURIComponent(token)}`;
    const response = await fetch(url);
    const data = (await response.json()) as {
      field_data?: Array<{ name?: string; values?: string[] }>;
      ad_id?: string;
      adset_id?: string;
      campaign_id?: string;
      form_id?: string;
    };
    if (!response.ok) {
      console.warn('[meta-leads] enrich_failed', JSON.stringify({ leadgenId, status: response.status }));
      return {};
    }

    const fieldData: Record<string, string> = {};
    for (const field of data.field_data || []) {
      if (!field.name) continue;
      fieldData[field.name] = Array.isArray(field.values) ? String(field.values[0] || '') : '';
    }

    const phone =
      fieldData.phone_number
      || fieldData.phone
      || fieldData.mobile
      || fieldData.contact_number
      || undefined;
    const email = fieldData.email || undefined;
    const name =
      fieldData.full_name
      || [fieldData.first_name, fieldData.last_name].filter(Boolean).join(' ')
      || fieldData.name
      || undefined;

    return {
      name,
      phone,
      email,
      campaignId: data.campaign_id,
      fieldData,
    };
  } catch (error) {
    console.warn(
      '[meta-leads] enrich_error',
      error instanceof Error ? error.message : error,
    );
    return {};
  }
}
