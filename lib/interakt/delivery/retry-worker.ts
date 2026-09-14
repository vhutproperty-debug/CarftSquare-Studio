import type { Db } from 'mongodb';
import { getCampaign } from '@/lib/ops/campaigns/store';
import { getDeliveryRetryConfig } from '@/lib/interakt/delivery/config';
import {
  claimDueRetryJobs,
  markRetryJobStatus,
  cancelRetryJobsForRecipient,
} from '@/lib/interakt/delivery/retry-scheduler';
import { getDeliveryRecipient } from '@/lib/interakt/delivery/recipient-state';
import { submitRecipientMessage } from '@/lib/interakt/delivery/submit';
import { reconcileCampaign } from '@/lib/interakt/delivery/reconcile';
import { isTerminalDeliveryState } from '@/lib/interakt/delivery/state-machine';
import { OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION } from '@/lib/ops/campaigns/store';
import type { DeliveryState } from '@/lib/interakt/delivery/types';
import { transitionRecipientState } from '@/lib/interakt/delivery/recipient-state';

/**
 * Process due delivery retry jobs with pre-send guards.
 */
export async function processDeliveryRetries(
  db: Db,
  limit?: number,
): Promise<{ processed: number; sent: number; skipped: number; failed: number }> {
  const config = getDeliveryRetryConfig();
  const max = Math.min(limit || config.maxRetriesPerTick, config.maxRetriesPerTick);
  const claimed = await claimDueRetryJobs(db, max);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const job of claimed) {
    try {
      const recipient = await getDeliveryRecipient(db, job.recipientId);
      if (!recipient) {
        await markRetryJobStatus(db, job.id, 'skipped', 'recipient_missing');
        skipped += 1;
        continue;
      }

      const state = recipient.deliveryState;
      if (state && isTerminalDeliveryState(state) && state !== 'PERMANENT_FAILURE') {
        await markRetryJobStatus(db, job.id, 'skipped', `already_${state}`);
        skipped += 1;
        continue;
      }
      if (state === 'DELIVERED' || state === 'READ') {
        await markRetryJobStatus(db, job.id, 'skipped', `already_${state}`);
        skipped += 1;
        continue;
      }
      if (recipient.doNotContact) {
        await cancelRetryJobsForRecipient(db, recipient.id, 'opt_out');
        await transitionRecipientState(db, {
          recipientId: recipient.id,
          to: 'CANCELLED',
          eventSource: 'retry_worker',
          reason: 'opt_out_before_retry',
          doNotContact: true,
          force: true,
        });
        await markRetryJobStatus(db, job.id, 'cancelled', 'opt_out');
        skipped += 1;
        continue;
      }

      const campaign = await getCampaign(db, job.campaignId);
      if (!campaign || campaign.status === 'cancelled') {
        await markRetryJobStatus(db, job.id, 'cancelled', 'campaign_cancelled');
        skipped += 1;
        continue;
      }

      // Another retry already running for recipient?
      if (state === 'SUBMITTING' || state === 'RETRYING') {
        await markRetryJobStatus(db, job.id, 'skipped', 'already_in_flight');
        skipped += 1;
        continue;
      }

      const result = await submitRecipientMessage(db, {
        campaign,
        recipientId: recipient.id,
        eventSource: 'retry_worker',
        isRetry: true,
        retryJobId: job.id,
      });

      if (result.skipped) {
        await markRetryJobStatus(db, job.id, 'skipped', result.reason || 'skipped');
        skipped += 1;
      } else if (result.ok) {
        await markRetryJobStatus(db, job.id, 'succeeded');
        sent += 1;
      } else {
        await markRetryJobStatus(db, job.id, 'failed', result.reason || 'retry_failed');
        failed += 1;
      }
    } catch (error) {
      failed += 1;
      await markRetryJobStatus(
        db,
        job.id,
        'failed',
        error instanceof Error ? error.message : 'retry_error',
      );
    }
  }

  return { processed: claimed.length, sent, skipped, failed };
}

/**
 * Reclaim stuck SUBMITTING recipients after TTL (crash recovery).
 */
export async function reclaimStuckSubmitting(
  db: Db,
): Promise<number> {
  const config = getDeliveryRetryConfig();
  const cutoff = new Date(Date.now() - config.submittingTtlMs).toISOString();
  const stuck = (await db
    .collection(OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION)
    .find(
      {
        deliveryState: { $in: ['SUBMITTING', 'RETRYING'] as DeliveryState[] },
        updatedAt: { $lte: cutoff },
      },
      { projection: { _id: 0 } },
    )
    .limit(50)
    .toArray()) as Array<{
    id: string;
    campaignId: string;
    normalizedPhone: string;
    attemptCount?: number;
    providerMessageId?: string;
  }>;

  let reclaimed = 0;
  for (const row of stuck) {
    if (row.providerMessageId) {
      // API likely succeeded; wait for webhook — mark SUBMITTED
      await transitionRecipientState(db, {
        recipientId: row.id,
        to: 'SUBMITTED',
        eventSource: 'system',
        reason: 'reclaim_submitting_with_provider_id',
        providerMessageId: row.providerMessageId,
        force: true,
      });
    } else {
      // Unknown — conservative retry schedule or UNKNOWN
      const attemptNumber = row.attemptCount || 1;
      if (attemptNumber >= config.maxAttempts) {
        await transitionRecipientState(db, {
          recipientId: row.id,
          to: 'PERMANENT_FAILURE',
          eventSource: 'system',
          reason: 'stuck_submitting_exhausted',
          failureClass: 'UNKNOWN',
          reviewRequired: true,
          force: true,
        });
      } else {
        const { job } = await import('@/lib/interakt/delivery/retry-scheduler').then((m) =>
          m.scheduleDeliveryRetry(db, {
            campaignId: row.campaignId,
            recipientId: row.id,
            attemptId: 'reclaim',
            normalizedPhone: row.normalizedPhone,
            attemptNumber,
          }),
        );
        await transitionRecipientState(db, {
          recipientId: row.id,
          to: 'RETRY_SCHEDULED',
          eventSource: 'system',
          reason: 'stuck_submitting_reclaim',
          failureClass: 'UNKNOWN',
          nextRetryAt: job.scheduledFor,
          reviewRequired: true,
          force: true,
        });
      }
    }
    await reconcileCampaign(db, row.campaignId);
    reclaimed += 1;
  }
  return reclaimed;
}

export async function runDeliveryEngineTick(db: Db): Promise<{
  retries: Awaited<ReturnType<typeof processDeliveryRetries>>;
  reclaimed: number;
}> {
  const reclaimed = await reclaimStuckSubmitting(db);
  const retries = await processDeliveryRetries(db);
  return { retries, reclaimed };
}
