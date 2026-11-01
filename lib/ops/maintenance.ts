import { getCampaignDatabase, listCampaigns } from '@/lib/ops/campaigns/store';
import { processCampaignBatch } from '@/lib/ops/campaigns/worker';
import { getFollowUpDatabase } from '@/lib/ops/followups/store';
import { processDueFollowUpJobs } from '@/lib/ops/followups/worker';
import { processLeadEnrichJobs } from '@/lib/meta-leads/ingest';
import { syncMetaAdsInsights } from '@/lib/meta-ads/insights';
import { getMetaAdsDatabase } from '@/lib/meta-ads/store';
import { reconcileCampaign } from '@/lib/whatsapp-cloud/delivery/reconcile';
import { runDeliveryEngineTick } from '@/lib/whatsapp-cloud/delivery/retry-worker';
import { listTemplates } from '@/lib/whatsapp-cloud/client';
import { upsertSyncedTemplates } from '@/lib/whatsapp-cloud/templates';
import { getWaDatabase } from '@/lib/whatsapp-cloud/webhook-store';

export type OpsMaintenanceOptions = {
  limit?: number;
  /** Pull approved template statuses from Meta. Safe to skip when WhatsApp is not configured. */
  syncTemplates?: boolean;
  /** Pull ad insights. No-op unless META_ADS_ENABLED=true. */
  syncInsights?: boolean;
};

/**
 * Due follow-ups, delivery retries, lead enrichment, and optional Meta syncs.
 * Invoked by the daily Vercel cron and inline after lead/WhatsApp events.
 */
export async function runOpsMaintenance(options: OpsMaintenanceOptions = {}) {
  const limit = options.limit ?? 10;
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
  const leadEnrich = await processLeadEnrichJobs(db, limit);

  for (const campaign of campaigns) {
    if (['running', 'waiting_for_delivery', 'retrying', 'queued'].includes(campaign.status)) {
      await reconcileCampaign(campaignDb, campaign.id);
    }
  }

  let templates: { synced: number; error?: string } | null = null;
  if (options.syncTemplates) {
    try {
      const rows = await listTemplates();
      const waDb = await getWaDatabase();
      templates = { synced: await upsertSyncedTemplates(waDb, rows) };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'template_sync_failed';
      console.warn('[ops-maintenance] template_sync_failed', message);
      templates = { synced: 0, error: message };
    }
  }

  let insights: { skipped?: boolean; synced?: number; error?: string } | null = null;
  if (options.syncInsights) {
    try {
      const adsDb = await getMetaAdsDatabase();
      const result = await syncMetaAdsInsights(adsDb);
      insights = { skipped: result.skipped, synced: result.synced };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'insights_sync_failed';
      console.warn('[ops-maintenance] insights_sync_failed', message);
      insights = { error: message };
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
    leadEnrich,
    templates,
    insights,
  };
  console.info('[ops-maintenance] tick', JSON.stringify(result));
  return result;
}
