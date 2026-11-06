import type { Db } from 'mongodb';
import {
  findAttemptByProviderMessageId,
  getLatestAttempt,
  markAttemptOutcome,
  listAttemptsForRecipient,
} from '@/lib/whatsapp-cloud/delivery/attempts';
import { classifyDeliveryFailure } from '@/lib/whatsapp-cloud/delivery/failure-classifier';
import { getDeliveryRetryConfig } from '@/lib/whatsapp-cloud/delivery/config';
import {
  cancelRetryJobsForRecipient,
  scheduleDeliveryRetry,
} from '@/lib/whatsapp-cloud/delivery/retry-scheduler';
import {
  getDeliveryRecipient,
  transitionRecipientState,
} from '@/lib/whatsapp-cloud/delivery/recipient-state';
import { reconcileCampaign } from '@/lib/whatsapp-cloud/delivery/reconcile';
import {
  mapWaStatusToDeliveryState,
  shouldApplyDeliveryState,
} from '@/lib/whatsapp-cloud/delivery/state-machine';
import type { DeliveryState } from '@/lib/whatsapp-cloud/delivery/types';
import { OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION } from '@/lib/ops/campaigns/store';
import { isOptedOut, recordOptOut } from '@/lib/whatsapp-cloud/consent';

function parseCallbackData(callbackData: string | null | undefined): {
  campaignId?: string;
  recipientId?: string;
  attemptNumber?: number;
} {
  if (!callbackData) return {};
  // campaign:{campaignId}:{recipientId}:attempt:{n}
  // campaign:{campaignId}:{recipientId}
  const parts = callbackData.split(':');
  if (parts[0] !== 'campaign' || parts.length < 3) return {};
  const campaignId = parts[1];
  const recipientId = parts[2];
  let attemptNumber: number | undefined;
  if (parts[3] === 'attempt' && parts[4]) attemptNumber = Number(parts[4]);
  return { campaignId, recipientId, attemptNumber };
}

/**
 * Bridge Wa outbound status webhooks into delivery engine.
 * Safe under duplicate webhooks — no duplicate retries.
 */
export async function applyOutboundStatusToDeliveryEngine(
  db: Db,
  input: {
    providerMessageId: string;
    providerEventId: string;
    waStatus: string;
    callbackData?: string | null;
    channelErrorCode?: string | null;
    channelFailureReason?: string | null;
  },
): Promise<{ handled: boolean; reason?: string }> {
  let attempt = await findAttemptByProviderMessageId(db, input.providerMessageId);
  let recipientId = attempt?.recipientId;
  let campaignId = attempt?.campaignId;

  if (!recipientId) {
    const parsed = parseCallbackData(input.callbackData);
    if (parsed.recipientId) {
      recipientId = parsed.recipientId;
      campaignId = parsed.campaignId;
      const latest = await getLatestAttempt(db, recipientId);
      attempt = latest;
      // Link provider id onto attempt if missing (crash after API success)
      if (latest && !latest.providerMessageId) {
        await markAttemptOutcome(db, latest.id, {
          providerMessageId: input.providerMessageId,
          deliveryState: 'SUBMITTED',
          submittedAt: latest.submittedAt || new Date().toISOString(),
        });
        attempt = await getLatestAttempt(db, recipientId);
      }
    }
  }

  if (!recipientId) {
    // Fallback: match by providerMessageId on recipient doc
    const byProvider = (await db.collection(OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION).findOne(
      { providerMessageId: input.providerMessageId },
      { projection: { _id: 0 } },
    )) as { id?: string; campaignId?: string } | null;
    if (byProvider?.id) {
      recipientId = byProvider.id;
      campaignId = byProvider.campaignId;
    }
  }

  if (!recipientId || !campaignId) {
    return { handled: false, reason: 'no_campaign_recipient_match' };
  }

  const recipient = await getDeliveryRecipient(db, recipientId);
  if (!recipient) return { handled: false, reason: 'recipient_missing' };

  // Duplicate provider event — no-op
  if (recipient.lastProviderEventId === input.providerEventId) {
    return { handled: true, reason: 'duplicate_event' };
  }

  let mapped = mapWaStatusToDeliveryState(input.waStatus);
  if (!mapped) return { handled: false, reason: 'unmapped_status' };

  if (mapped === 'TEMPORARY_FAILURE' || input.waStatus === 'failed') {
    const classified = classifyDeliveryFailure({
      channelErrorCode: input.channelErrorCode,
      channelFailureReason: input.channelFailureReason,
    });

    if (classified.code === '131050') {
      await recordOptOut(db, recipient.normalizedPhone);
      await cancelRetryJobsForRecipient(db, recipientId, 'user_stopped_marketing_131050');
      if (attempt) {
        await markAttemptOutcome(db, attempt.id, {
          providerMessageId: input.providerMessageId,
          providerStatus: input.waStatus,
          deliveryState: 'PERMANENT_FAILURE',
          failureCode: '131050',
          failureReason: classified.reason,
          failureClass: 'PERMANENT',
          completedAt: new Date().toISOString(),
        });
      }
      await transitionRecipientState(db, {
        recipientId,
        to: 'PERMANENT_FAILURE',
        eventSource: 'wa_webhook',
        reason: 'user_stopped_marketing_131050',
        providerMessageId: input.providerMessageId,
        providerEventId: input.providerEventId,
        attemptId: attempt?.id,
        failureClass: 'PERMANENT',
        failureCode: '131050',
        failureReason: classified.reason,
        force: true,
      });
      await reconcileCampaign(db, campaignId);
      return { handled: true, reason: 'opted_out_131050' };
    }

    if (recipient.doNotContact || await isOptedOut(db, recipient.normalizedPhone)) {
      await cancelRetryJobsForRecipient(db, recipientId, 'opt_out');
      if (attempt) {
        await markAttemptOutcome(db, attempt.id, {
          providerMessageId: input.providerMessageId,
          providerStatus: input.waStatus,
          deliveryState: 'PERMANENT_FAILURE',
          failureCode: classified.code,
          failureReason: classified.reason,
          failureClass: 'PERMANENT',
          completedAt: new Date().toISOString(),
        });
      }
      await transitionRecipientState(db, {
        recipientId,
        to: 'CANCELLED',
        eventSource: 'wa_webhook',
        reason: 'opt_out',
        providerMessageId: input.providerMessageId,
        providerEventId: input.providerEventId,
        attemptId: attempt?.id,
        failureClass: 'PERMANENT',
        failureCode: classified.code,
        failureReason: classified.reason,
        nextRetryAt: null,
        doNotContact: true,
        force: true,
      });
      await reconcileCampaign(db, campaignId);
      return { handled: true, reason: 'opted_out' };
    }

    if (attempt) {
      await markAttemptOutcome(db, attempt.id, {
        providerMessageId: input.providerMessageId,
        providerStatus: input.waStatus,
        deliveryState:
          classified.failureClass === 'PERMANENT' ? 'PERMANENT_FAILURE' : 'TEMPORARY_FAILURE',
        failureCode: classified.code,
        failureReason: classified.reason,
        failureClass: classified.failureClass,
        completedAt: classified.failureClass === 'PERMANENT' ? new Date().toISOString() : null,
      });
    }

    const attemptNumber = recipient.attemptCount || attempt?.attemptNumber || 1;
    const config = getDeliveryRetryConfig();
    const canRetry =
      classified.failureClass !== 'PERMANENT'
      && attemptNumber < config.maxAttempts
      && (classified.failureClass === 'RETRYABLE'
        || (classified.failureClass === 'UNKNOWN' && attemptNumber < config.unknownMaxAttempts));

    // Race: if already delivered/read, ignore failure
    const current = recipient.deliveryState;
    if (current === 'DELIVERED' || current === 'READ') {
      await cancelRetryJobsForRecipient(db, recipientId, 'already_succeeded');
      return { handled: true, reason: 'ignored_failure_after_success' };
    }

    if (canRetry) {
      // Cancel any prior queued retries for this attempt number pattern via idempotency
      const { job, created } = await scheduleDeliveryRetry(db, {
        campaignId,
        recipientId,
        attemptId: attempt?.id || 'unknown',
        normalizedPhone: recipient.normalizedPhone,
        attemptNumber,
        failureCode: classified.code,
      });

      await transitionRecipientState(db, {
        recipientId,
        to: 'RETRY_SCHEDULED',
        eventSource: 'wa_webhook',
        reason: classified.reason,
        providerMessageId: input.providerMessageId,
        providerEventId: input.providerEventId,
        attemptId: attempt?.id,
        failureClass: classified.failureClass,
        failureCode: classified.code,
        failureReason: classified.reason,
        nextRetryAt: job.scheduledFor,
        retryAttempt: attemptNumber,
        reviewRequired: classified.failureClass === 'UNKNOWN',
        force: true,
      });

      console.info(
        '[wa-delivery] failure_retry_scheduled',
        JSON.stringify({
          recipientId,
          campaignId,
          created,
          failureClass: classified.failureClass,
          scheduledFor: job.scheduledFor,
        }),
      );
    } else {
      await cancelRetryJobsForRecipient(db, recipientId, 'permanent_or_exhausted');
      await transitionRecipientState(db, {
        recipientId,
        to: 'PERMANENT_FAILURE',
        eventSource: 'wa_webhook',
        reason: classified.reason,
        providerMessageId: input.providerMessageId,
        providerEventId: input.providerEventId,
        attemptId: attempt?.id,
        failureClass: classified.failureClass === 'RETRYABLE' ? 'PERMANENT' : classified.failureClass,
        failureCode: classified.code,
        failureReason: classified.reason,
        force: true,
      });
    }

    await reconcileCampaign(db, campaignId);
    return { handled: true };
  }

  // Success path: SENT / DELIVERED / READ
  const target = mapped as DeliveryState;
  if (!shouldApplyDeliveryState(recipient.deliveryState || 'SUBMITTED', target)) {
    return { handled: true, reason: 'state_not_applied' };
  }

  if (attempt) {
    await markAttemptOutcome(db, attempt.id, {
      providerMessageId: input.providerMessageId,
      providerStatus: input.waStatus,
      deliveryState: target,
      completedAt: target === 'DELIVERED' || target === 'READ' ? new Date().toISOString() : null,
    });
  }

  // Cancel pending retries — delayed success while retry scheduled
  if (target === 'DELIVERED' || target === 'READ' || target === 'SENT') {
    await cancelRetryJobsForRecipient(db, recipientId, `provider_${target}`);
  }

  await transitionRecipientState(db, {
    recipientId,
    to: target,
    eventSource: 'wa_webhook',
    reason: `provider_${input.waStatus}`,
    providerMessageId: input.providerMessageId,
    providerEventId: input.providerEventId,
    attemptId: attempt?.id,
    force: true,
  });

  await reconcileCampaign(db, campaignId);
  return { handled: true };
}

/** Stop / opt-out: drop queued retries so a later tick cannot send again. */
export async function cancelQueuedRetriesForPhone(
  db: Db,
  normalizedPhone: string,
  reason: string,
): Promise<number> {
  if (!normalizedPhone || normalizedPhone.startsWith('invalid:')) return 0;
  const rows = (await db.collection(OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION).find(
    {
      normalizedPhone,
      deliveryState: { $in: ['QUEUED', 'RETRY_SCHEDULED', 'TEMPORARY_FAILURE', 'UNKNOWN'] },
    },
    { projection: { _id: 0, id: 1, campaignId: 1 } },
  ).toArray()) as Array<{ id?: string; campaignId?: string }>;

  const campaigns = new Set<string>();
  let cancelled = 0;
  for (const row of rows) {
    if (!row.id) continue;
    await cancelRetryJobsForRecipient(db, row.id, reason);
    await transitionRecipientState(db, {
      recipientId: row.id,
      to: 'CANCELLED',
      eventSource: 'wa_webhook',
      reason,
      doNotContact: true,
      failureClass: 'PERMANENT',
      nextRetryAt: null,
      force: true,
    });
    if (row.campaignId) campaigns.add(row.campaignId);
    cancelled += 1;
  }
  for (const campaignId of campaigns) {
    await reconcileCampaign(db, campaignId);
  }
  return cancelled;
}

export async function getRecipientDeliveryDebug(db: Db, recipientId: string) {
  const recipient = await getDeliveryRecipient(db, recipientId);
  const attempts = await listAttemptsForRecipient(db, recipientId);
  return { recipient, attempts };
}
