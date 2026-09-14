import type { Db } from 'mongodb';
import { maskPhoneForLog } from '@/lib/interakt/phone';
import { submitRecipientMessage } from '@/lib/interakt/delivery/submit';
import { reconcileCampaign } from '@/lib/interakt/delivery/reconcile';
import {
  OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION,
  ensureCampaignIndexes,
  getCampaign,
  updateCampaignStatus,
} from '@/lib/ops/campaigns/store';
import type { OpsWaCampaignRecipient } from '@/lib/ops/campaigns/types';

/**
 * Process a throttled batch of queued campaign recipients via delivery engine.
 * Does NOT mark campaign completed when queue empties — reconciliation owns completion.
 */
export async function processCampaignBatch(
  db: Db,
  campaignId: string,
): Promise<{ processed: number; sent: number; failed: number; skipped: number }> {
  await ensureCampaignIndexes(db);
  const campaign = await getCampaign(db, campaignId);
  if (!campaign) throw Object.assign(new Error('Campaign not found.'), { status: 404 });
  if (campaign.status === 'cancelled') {
    return { processed: 0, sent: 0, failed: 0, skipped: 0 };
  }

  const limit = Math.min(campaign.throttlePerMinute, 30);
  const queued = (await db
    .collection(OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION)
    .find(
      {
        campaignId,
        $or: [
          { deliveryState: 'QUEUED' },
          { deliveryState: { $exists: false }, status: 'queued' },
        ],
      },
      { projection: { _id: 0 } },
    )
    .limit(limit)
    .toArray()) as unknown as OpsWaCampaignRecipient[];

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const recipient of queued) {
    const result = await submitRecipientMessage(db, {
      campaign,
      recipientId: recipient.id,
      eventSource: 'campaign_worker',
    });
    if (result.skipped) skipped += 1;
    else if (result.ok) {
      sent += 1;
      console.info(
        '[ops-campaigns] recipient_sent',
        JSON.stringify({
          campaignId,
          recipientId: recipient.id,
          phone: maskPhoneForLog(recipient.normalizedPhone),
          providerMessageId: result.providerMessageId,
        }),
      );
    } else failed += 1;
  }

  await reconcileCampaign(db, campaignId);
  return { processed: queued.length, sent, failed, skipped };
}

export async function startCampaign(db: Db, campaignId: string) {
  await updateCampaignStatus(db, campaignId, 'running', {
    startedAt: new Date().toISOString(),
  });
  // Ensure recipients have deliveryState
  await db.collection(OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION).updateMany(
    { campaignId, deliveryState: { $exists: false }, status: 'queued' },
    { $set: { deliveryState: 'QUEUED' } },
  );
  return processCampaignBatch(db, campaignId);
}
