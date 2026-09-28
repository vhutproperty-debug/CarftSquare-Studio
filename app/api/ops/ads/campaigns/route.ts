import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsEditAccess, requireOpsViewAccess } from '@/lib/ops/auth';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { getMetaAdsDefaultDailyBudgetInr } from '@/lib/meta-ads/config';
import { publishPausedLeadCampaign } from '@/lib/meta-ads/publish-paused';
import { getMetaAdsReadiness } from '@/lib/meta-ads/readiness';
import {
  createCampaignRecord,
  getCampaignRecord,
  getCreative,
  getMetaAdsDatabase,
  listCampaignRecords,
  updateCampaignRecord,
  updateCreativeStatus,
} from '@/lib/meta-ads/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const db = await getMetaAdsDatabase();
    const campaigns = await listCampaignRecords(db);
    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error('[ops-ads] campaigns_list_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to list Meta campaigns.' }, { status: 500 });
  }
}

const createSchema = z.object({
  name: z.string().trim().min(3).max(120),
  creativeId: z.string().uuid(),
  areas: z.array(z.string().trim().min(2).max(80)).max(8).optional(),
  dailyBudgetInr: z.number().int().min(100).max(5000).optional(),
  destination: z.enum(['instant_form', 'website']).optional(),
});

export async function POST(request: Request) {
  const auth = await requireOpsEditAccess(request);
  if (!auth.ok) return authResultToResponse(auth);

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const db = await getMetaAdsDatabase();
    const creative = await getCreative(db, parsed.data.creativeId);
    if (!creative) return NextResponse.json({ error: 'Creative not found.' }, { status: 404 });
    if (creative.status !== 'approved') {
      return NextResponse.json({ error: 'Creative must be approved before campaign dry-run.' }, { status: 400 });
    }

    const campaign = await createCampaignRecord(db, {
      name: parsed.data.name,
      creativeId: creative.id,
      objective: 'OUTCOME_LEADS',
      destination: parsed.data.destination || 'instant_form',
      dailyBudgetInr: parsed.data.dailyBudgetInr || getMetaAdsDefaultDailyBudgetInr(),
      status: 'ready',
      areas: parsed.data.areas || creative.areas || ['Mumbai'],
      createdBy: auth.admin.id,
    });

    await logOpsActivity({
      action: 'meta_ads_campaign_create',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_meta_ad_campaigns',
      resourceId: campaign.id,
      details: { dryRun: true, creativeId: creative.id },
      request,
    });

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    console.error('[ops-ads] campaigns_create_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to create campaign record.' }, { status: 500 });
  }
}

const publishSchema = z.object({
  id: z.string().uuid(),
  action: z.literal('publish_paused'),
});

export async function PATCH(request: Request) {
  const auth = await requireOpsEditAccess(request);
  if (!auth.ok) return authResultToResponse(auth);

  try {
    const body = await request.json();
    const parsed = publishSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const db = await getMetaAdsDatabase();
    const campaign = await getCampaignRecord(db, parsed.data.id);
    if (!campaign) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });

    const creative = await getCreative(db, campaign.creativeId);
    if (!creative || creative.status !== 'approved') {
      return NextResponse.json({ error: 'Approved creative required.' }, { status: 400 });
    }

    const readiness = await getMetaAdsReadiness();
    if (!readiness.canPublishPaused) {
      await updateCampaignRecord(db, campaign.id, {
        status: 'awaiting_ads_token',
        lastError: readiness.blockers[0] || 'Missing ads_management token',
      });
      return NextResponse.json(
        {
          ok: false,
          error: readiness.blockers[0] || 'Cannot publish — ads_management token required.',
          readiness,
          campaign: await getCampaignRecord(db, campaign.id),
        },
        { status: 409 },
      );
    }

    await updateCampaignRecord(db, campaign.id, { status: 'publishing', lastError: undefined });
    const result = await publishPausedLeadCampaign({ campaign, creative });

    if (!result.ok) {
      await updateCampaignRecord(db, campaign.id, {
        status: 'failed',
        lastError: result.error,
      });
      return NextResponse.json(
        { ok: false, error: result.error, campaign: await getCampaignRecord(db, campaign.id) },
        { status: 502 },
      );
    }

    const updated = await updateCampaignRecord(db, campaign.id, {
      status: 'paused_on_meta',
      metaStatus: 'PAUSED',
      metaCampaignId: result.metaCampaignId,
      metaAdSetId: result.metaAdSetId,
      metaCreativeId: result.metaCreativeId,
      metaAdId: result.metaAdId,
      metaLeadFormId: result.metaLeadFormId,
      publishedAt: new Date().toISOString(),
      lastError: undefined,
    });
    await updateCreativeStatus(db, creative.id, 'published');

    await logOpsActivity({
      action: 'meta_ads_publish_paused',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_meta_ad_campaigns',
      resourceId: campaign.id,
      details: {
        dryRun: true,
        metaCampaignId: result.metaCampaignId,
        metaAdId: result.metaAdId,
      },
      request,
    });

    return NextResponse.json({ ok: true, campaign: updated, result });
  } catch (error) {
    console.error('[ops-ads] campaigns_publish_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to publish paused campaign.' }, { status: 500 });
  }
}
