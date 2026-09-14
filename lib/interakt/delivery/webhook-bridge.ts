import type { Db } from 'mongodb';
import {
  findAttemptByProviderMessageId,
  getLatestAttempt,
  markAttemptOutcome,
  listAttemptsForRecipient,
} from '@/lib/interakt/delivery/attempts';
import { classifyDeliveryFailure } from '@/lib/interakt/delivery/failure-classifier';
import { getDeliveryRetryConfig } from '@/lib/interakt/delivery/config';
import {
  cancelRetryJobsForRecipient,
  scheduleDeliveryRetry,
} from '@/lib/interakt/delivery/retry-scheduler';
import {
  getDeliveryRecipient,
  transitionRecipientState,
} from '@/lib/interakt/delivery/recipient-state';
import { reconcileCampaign } from '@/lib/interakt/delivery/reconcile';
import {
  mapInteraktStatusToDeliveryState,
  shouldApplyDeliveryState,
} from '@/lib/interakt/delivery/state-machine';
import type { DeliveryState } from '@/lib/interakt/delivery/types';
import { OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION } from '@/lib/ops/campaigns/store';

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
 * Bridge Interakt outbound status webhooks into delivery engine.
 * Safe under duplicate webhooks — no duplicate retries.
 */
export async function applyOutboundStatusToDeliveryEngine(
  db: Db,
  input: {
    providerMessageId: string;
    providerEventId: string;
    interaktStatus: string;
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

  let mapped = mapInteraktStatusToDeliveryState(input.interaktStatus);
  if (!mapped) return { handled: false, reason: 'unmapped_status' };

  if (mapped === 'TEMPORARY_FAILURE' || input.interaktStatus === 'failed') {
    const classified = classifyDeliveryFailure({
      channelErrorCode: input.channelErrorCode,
      channelFailureReason: input.channelFailureReason,
    });

    if (attempt) {
      await markAttemptOutcome(db, attempt.id, {
        providerMessageId: input.providerMessageId,
        providerStatus: input.interaktStatus,
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
      });

      await transitionRecipientState(db, {
        recipientId,
        to: 'RETRY_SCHEDULED',
        eventSource: 'interakt_webhook',
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
        '[interakt-delivery] failure_retry_scheduled',
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
        eventSource: 'interakt_webhook',
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
      providerStatus: input.interaktStatus,
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
    eventSource: 'interakt_webhook',
    reason: `provider_${input.interaktStatus}`,
    providerMessageId: input.providerMessageId,
    providerEventId: input.providerEventId,
    attemptId: attempt?.id,
    force: true,
  });

  await reconcileCampaign(db, campaignId);
  return { handled: true };
}

export async function getRecipientDeliveryDebug(db: Db, recipientId: string) {
  const recipient = await getDeliveryRecipient(db, recipientId);
  const attempts = await listAttemptsForRecipient(db, recipientId);
  return { recipient, attempts };
}
