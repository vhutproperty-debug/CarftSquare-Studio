import type { Db } from 'mongodb';
import type { DeliveryCampaignLifecycle, DeliveryStats, DeliveryState } from '@/lib/interakt/delivery/types';
import { isTerminalDeliveryState } from '@/lib/interakt/delivery/state-machine';
import { legacyStatusToDeliveryState } from '@/lib/interakt/delivery/recipient-state';
import {
  OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION,
  OPS_WA_CAMPAIGNS_COLLECTION,
} from '@/lib/ops/campaigns/store';

function emptyStats(): DeliveryStats {
  return {
    total: 0,
    queued: 0,
    submitting: 0,
    submitted: 0,
    pending: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    temporaryFailure: 0,
    retryScheduled: 0,
    retrying: 0,
    permanentFailure: 0,
    cancelled: 0,
    unknown: 0,
    skipped: 0,
    terminal: 0,
    nonTerminal: 0,
  };
}

function bump(stats: DeliveryStats, state: DeliveryState) {
  switch (state) {
    case 'QUEUED':
      stats.queued += 1;
      break;
    case 'SUBMITTING':
      stats.submitting += 1;
      break;
    case 'SUBMITTED':
    case 'ACCEPTED':
      stats.submitted += 1;
      break;
    case 'PENDING':
      stats.pending += 1;
      break;
    case 'SENT':
      stats.sent += 1;
      break;
    case 'DELIVERED':
      stats.delivered += 1;
      break;
    case 'READ':
      stats.read += 1;
      break;
    case 'TEMPORARY_FAILURE':
      stats.temporaryFailure += 1;
      break;
    case 'RETRY_SCHEDULED':
      stats.retryScheduled += 1;
      break;
    case 'RETRYING':
      stats.retrying += 1;
      break;
    case 'PERMANENT_FAILURE':
      stats.permanentFailure += 1;
      break;
    case 'CANCELLED':
      stats.cancelled += 1;
      stats.skipped += 1;
      break;
    case 'UNKNOWN':
      stats.unknown += 1;
      break;
    default:
      break;
  }
  if (isTerminalDeliveryState(state)) stats.terminal += 1;
  else stats.nonTerminal += 1;
}

export async function computeCampaignDeliveryStats(
  db: Db,
  campaignId: string,
): Promise<DeliveryStats> {
  const rows = (await db
    .collection(OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION)
    .find({ campaignId }, { projection: { _id: 0, status: 1, deliveryState: 1 } })
    .toArray()) as Array<{ status: string; deliveryState?: DeliveryState }>;

  const stats = emptyStats();
  stats.total = rows.length;
  for (const row of rows) {
    const state = row.deliveryState || legacyStatusToDeliveryState(row.status);
    bump(stats, state);
  }
  return stats;
}

export function evaluateCampaignLifecycle(
  currentStatus: string,
  stats: DeliveryStats,
): DeliveryCampaignLifecycle {
  if (currentStatus === 'cancelled') return 'cancelled';
  if (currentStatus === 'draft') return 'draft';
  if (currentStatus === 'scheduled') return 'scheduled';
  if (currentStatus === 'failed') return 'failed';

  if (stats.total === 0) return 'draft';

  if (stats.nonTerminal === 0) {
    if (stats.permanentFailure > 0 || stats.cancelled > 0) return 'completed_with_failures';
    return 'completed';
  }

  if (stats.retryScheduled > 0 || stats.retrying > 0 || stats.temporaryFailure > 0) {
    return 'retrying';
  }

  if (stats.queued > 0 || stats.submitting > 0) return 'running';

  return 'waiting_for_delivery';
}

/**
 * CraftSquare source-of-truth campaign reconciliation.
 * Never marks completed merely because initial submissions finished.
 */
export async function reconcileCampaign(
  db: Db,
  campaignId: string,
): Promise<{
  stats: DeliveryStats;
  lifecycle: DeliveryCampaignLifecycle;
  completed: boolean;
}> {
  const campaign = await db.collection(OPS_WA_CAMPAIGNS_COLLECTION).findOne(
    { id: campaignId },
    { projection: { _id: 0, status: 1 } },
  );
  if (!campaign) {
    throw Object.assign(new Error('Campaign not found.'), { status: 404 });
  }

  const stats = await computeCampaignDeliveryStats(db, campaignId);
  const lifecycle = evaluateCampaignLifecycle(String(campaign.status), stats);
  const completed = lifecycle === 'completed' || lifecycle === 'completed_with_failures';
  const now = new Date().toISOString();

  await db.collection(OPS_WA_CAMPAIGNS_COLLECTION).updateOne(
    { id: campaignId },
    {
      $set: {
        status: lifecycle,
        deliveryStats: stats,
        // Keep legacy stats fields populated for older UI
        stats: {
          total: stats.total,
          queued: stats.queued,
          sent: stats.sent + stats.submitted + stats.pending + stats.delivered + stats.read,
          failed: stats.permanentFailure + stats.temporaryFailure + stats.unknown,
          skipped: stats.skipped,
          delivered: stats.delivered,
          read: stats.read,
          retrying: stats.retrying + stats.retryScheduled,
          permanentFailure: stats.permanentFailure,
          temporaryFailure: stats.temporaryFailure,
        },
        ...(completed ? { completedAt: now } : { completedAt: null }),
        updatedAt: now,
      },
    },
  );

  return { stats, lifecycle, completed };
}
