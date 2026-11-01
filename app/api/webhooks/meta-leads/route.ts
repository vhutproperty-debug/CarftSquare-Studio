import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { getDb } from '@/lib/mongodb';
import { verifyXHubSignature256 } from '@/lib/whatsapp-cloud/signature';
import { ensureMetaAdsLeadIndexes } from '@/lib/ops/leads/adapters/meta-ads';
import { processLeadgenPayload } from '@/lib/meta-leads/ingest';
import { runOpsMaintenance } from '@/lib/ops/maintenance';
import { sendMetaConversionEvent } from '@/lib/meta-capi/server';
import { isValidIndianMobile, normalizeIndianMobile } from '@/lib/phone/indian-mobile';

export const runtime = 'nodejs';

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

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256');
  if (!verifyXHubSignature256(rawBody, signature)) {
    console.warn('[meta-leads] signature_invalid');
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
  }

  let body: {
    object?: string;
    entry?: Array<{
      id?: string;
      changes?: Array<{ field?: string; value?: { leadgen_id?: string; form_id?: string } }>;
    }>;
  };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  try {
    const db = await getDb();
    await ensureMetaAdsLeadIndexes(db);
    const result = await processLeadgenPayload(db, body);

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const leadgenId = change.value?.leadgen_id;
        if (change.field !== 'leadgen' || !leadgenId) continue;
        const lead = await db.collection('meta_ads_leads').findOne({ id: String(leadgenId) });
        if (!lead) continue;
        const phone = normalizeIndianMobile((lead as { phone?: string }).phone);
        const name = String((lead as { name?: string }).name || '');
        const [firstName, ...rest] = name.trim().split(/\s+/);
        waitUntil(
          sendMetaConversionEvent({
            eventName: 'Lead',
            eventId: `meta-leadads:${leadgenId}`,
            eventSourceUrl: 'https://craftsquare.co.in/ops/leads',
            userData: {
              phone: isValidIndianMobile(phone) ? phone : undefined,
              email: (lead as { email?: string }).email,
              firstName: firstName || undefined,
              lastName: rest.length ? rest.join(' ') : undefined,
            },
            customData: {
              content_name: 'meta_lead_ads',
              form_id: (lead as { formId?: string }).formId,
              campaign_id: (lead as { campaignId?: string }).campaignId,
              lead_event_source: 'Meta Lead Ads Webhook',
            },
          }).catch((error) => {
            console.warn('[meta-leads] capi_failed', error instanceof Error ? error.message : error);
          }),
        );
      }
    }

    waitUntil(
      runOpsMaintenance({ limit: 5, syncTemplates: true }).catch((error) => {
        console.warn('[meta-leads] maintenance_failed', error instanceof Error ? error.message : error);
      }),
    );

    return NextResponse.json({ ok: true, accepted: result.accepted });
  } catch (error) {
    console.error('[meta-leads] webhook_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to process lead webhook.' }, { status: 500 });
  }
}
