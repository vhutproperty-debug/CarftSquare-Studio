import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsEditAccess } from '@/lib/ops/auth';
import { getFollowUpDatabase } from '@/lib/ops/followups/store';
import { processDueFollowUpJobs } from '@/lib/ops/followups/worker';
import { getCampaignDatabase, listCampaigns } from '@/lib/ops/campaigns/store';
import { processCampaignBatch } from '@/lib/ops/campaigns/worker';
import { runDeliveryEngineTick } from '@/lib/interakt/delivery/retry-worker';
import { reconcileCampaign } from '@/lib/interakt/delivery/reconcile';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Cron/worker: follow-ups + campaign batches + delivery retries/reclaim.
 */
async function authorizeTick(request: Request): Promise<Response | null> {
  const cronSecret = process.env.OPS_FOLLOWUPS_CRON_SECRET?.trim();
  const headerSecret = request.headers.get('x-ops-followups-secret');
  const authHeader = request.headers.get('authorization');
  const vercelCronSecret = process.env.CRON_SECRET?.trim();
  const authorizedByCron = Boolean(
    (cronSecret && headerSecret && headerSecret === cronSecret)
    || (vercelCronSecret && authHeader === `Bearer ${vercelCronSecret}`),
  );

  if (authorizedByCron) return null;

  const auth = await requireOpsEditAccess(request);
  return authResultToResponse(auth);
}

async function runTick(limit = 10) {
  const db = await getFollowUpDatabase();
  const followups = await processDueFollowUpJobs(db, limit);

  const campaignDb = await getCampaignDatabase();
  const campaigns = await listCampaigns(campaignDb, 20);
  let campaignSent = 0;
  let campaignFailed = 0;
  let campaignsProcessed = 0;
  for (const campaign of campaigns) {
    if (!['running', 'scheduled', 'queued'].includes(campaign.status)) continue;
    if (campaign.status === 'scheduled' && campaign.scheduledFor) {
      if (new Date(campaign.scheduledFor).getTime() > Date.now()) continue;
    }
    const batch = await processCampaignBatch(campaignDb, campaign.id);
    campaignSent += batch.sent;
    campaignFailed += batch.failed;
    campaignsProcessed += 1;
  }

  const delivery = await runDeliveryEngineTick(campaignDb);

  // Reconcile active non-terminal campaigns
  for (const campaign of campaigns) {
    if (
      ['running', 'waiting_for_delivery', 'retrying', 'queued'].includes(campaign.status)
    ) {
      await reconcileCampaign(campaignDb, campaign.id);
    }
  }

  const result = {
    followups,
    campaigns: {
      processed: campaignsProcessed,
      sent: campaignSent,
      failed: campaignFailed,
    },
    delivery,
  };
  console.info('[ops-followups] tick', JSON.stringify(result));
  return result;
}

export async function GET(request: Request) {
  const denied = await authorizeTick(request);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const result = await runTick(Number(searchParams.get('limit') || 10));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[ops-followups] tick_failed', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Follow-up tick failed.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const denied = await authorizeTick(request);
  if (denied) return denied;

  try {
    const body = await request.json().catch(() => ({}));
    const result = await runTick(Number(body.limit || 10));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[ops-followups] tick_failed', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Follow-up tick failed.' },
      { status: 500 },
    );
  }
}
