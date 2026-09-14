import type { Db } from 'mongodb';
import { sendInteraktTemplate } from '@/lib/interakt/client';
import { classifyDeliveryFailure } from '@/lib/interakt/delivery/failure-classifier';
import { createAttempt, markAttemptOutcome } from '@/lib/interakt/delivery/attempts';
import { getDeliveryRetryConfig } from '@/lib/interakt/delivery/config';
import { scheduleDeliveryRetry, cancelRetryJobsForRecipient } from '@/lib/interakt/delivery/retry-scheduler';
import { transitionRecipientState, getDeliveryRecipient } from '@/lib/interakt/delivery/recipient-state';
import { reconcileCampaign } from '@/lib/interakt/delivery/reconcile';
import { isTerminalDeliveryState } from '@/lib/interakt/delivery/state-machine';
import type { DeliveryEventSource } from '@/lib/interakt/delivery/types';
import {
  findConversationByPhone,
  touchConversationMessageMeta,
  upsertConversationIdentity,
} from '@/lib/interakt/conversation-store';
import { upsertInteraktMessage } from '@/lib/interakt/message-store';
import { getInteraktBusinessWaNumber, maskPhoneForLog } from '@/lib/interakt/phone';
import { getCampaign } from '@/lib/ops/campaigns/store';
import type { OpsWaCampaign } from '@/lib/ops/campaigns/types';

/**
 * Submit one campaign recipient template send with attempt ledger + crash-safe claiming.
 */
export async function submitRecipientMessage(
  db: Db,
  input: {
    campaign: OpsWaCampaign;
    recipientId: string;
    eventSource: DeliveryEventSource;
    isRetry?: boolean;
    retryJobId?: string;
  },
): Promise<{
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  providerMessageId?: string;
  attemptId?: string;
}> {
  const recipient = await getDeliveryRecipient(db, input.recipientId);
  if (!recipient) return { ok: false, reason: 'recipient_not_found' };

  const currentState = recipient.deliveryState;
  if (recipient.doNotContact) {
    await transitionRecipientState(db, {
      recipientId: recipient.id,
      to: 'CANCELLED',
      eventSource: input.eventSource,
      reason: 'opt_out_or_do_not_contact',
      doNotContact: true,
      force: true,
    });
    await cancelRetryJobsForRecipient(db, recipient.id, 'do_not_contact');
    await reconcileCampaign(db, recipient.campaignId);
    return { ok: false, skipped: true, reason: 'do_not_contact' };
  }

  const campaign = input.campaign.status
    ? input.campaign
    : await getCampaign(db, recipient.campaignId);
  if (!campaign || ['cancelled', 'failed'].includes(campaign.status)) {
    return { ok: false, skipped: true, reason: 'campaign_cancelled' };
  }

  if (
    currentState
    && isTerminalDeliveryState(currentState)
    && currentState !== 'PERMANENT_FAILURE'
  ) {
    // Already delivered/read/cancelled — never resend
    return { ok: false, skipped: true, reason: `already_${currentState}` };
  }
  if (currentState === 'DELIVERED' || currentState === 'READ' || currentState === 'CANCELLED') {
    return { ok: false, skipped: true, reason: `already_${currentState}` };
  }

  const attemptNumber = (recipient.attemptCount || 0) + 1;
  const config = getDeliveryRetryConfig();
  if (attemptNumber > config.maxAttempts) {
    await transitionRecipientState(db, {
      recipientId: recipient.id,
      to: 'PERMANENT_FAILURE',
      eventSource: input.eventSource,
      reason: 'max_retries_exhausted',
      failureClass: 'PERMANENT',
      failureReason: 'max_retries_exhausted',
      force: true,
    });
    await reconcileCampaign(db, recipient.campaignId);
    return { ok: false, skipped: true, reason: 'max_retries_exhausted' };
  }

  const toState = input.isRetry ? 'RETRYING' : 'SUBMITTING';
  const claimed = await transitionRecipientState(db, {
    recipientId: recipient.id,
    to: toState,
    eventSource: input.eventSource,
    reason: input.isRetry ? 'retry_claimed' : 'submit_claimed',
    attemptCount: attemptNumber,
    force: Boolean(input.isRetry || currentState === 'QUEUED' || currentState === 'RETRY_SCHEDULED' || !currentState),
  });
  if (!claimed.applied && !input.isRetry) {
    // Another worker may have claimed
    return { ok: false, skipped: true, reason: 'claim_lost' };
  }

  if (input.isRetry) {
    await transitionRecipientState(db, {
      recipientId: recipient.id,
      to: 'SUBMITTING',
      eventSource: input.eventSource,
      reason: 'retry_submitting',
      attemptCount: attemptNumber,
      force: true,
    });
  }

  const submitIdempotencyKey = `submit:${recipient.id}:${attemptNumber}`;
  const callbackData = `campaign:${campaign.id}:${recipient.id}:attempt:${attemptNumber}`;
  const { attempt, created } = await createAttempt(db, {
    campaignId: campaign.id,
    recipientId: recipient.id,
    attemptNumber,
    normalizedPhone: recipient.normalizedPhone,
    templateName: campaign.templateName,
    languageCode: campaign.languageCode,
    bodyValues: campaign.bodyValues,
    submitIdempotencyKey,
    callbackData,
    deliveryState: 'SUBMITTING',
  });

  // Crash recovery: if attempt already has providerMessageId, do not resend
  if (!created && attempt.providerMessageId) {
    await transitionRecipientState(db, {
      recipientId: recipient.id,
      to: 'SUBMITTED',
      eventSource: input.eventSource,
      reason: 'recovered_existing_provider_message',
      providerMessageId: attempt.providerMessageId,
      attemptId: attempt.id,
      currentAttemptId: attempt.id,
      attemptCount: attemptNumber,
      force: true,
    });
    await reconcileCampaign(db, campaign.id);
    return {
      ok: true,
      skipped: true,
      reason: 'recovered_existing_attempt',
      providerMessageId: attempt.providerMessageId,
      attemptId: attempt.id,
    };
  }

  try {
    const result = await sendInteraktTemplate({
      countryCode: '+91',
      phoneNumber: recipient.normalizedPhone,
      campaignId: campaign.id,
      callbackData,
      template: {
        name: campaign.templateName,
        languageCode: campaign.languageCode,
        bodyValues: campaign.bodyValues,
      },
    });

    if (!result.id) {
      throw Object.assign(new Error('Interakt returned no message id'), {
        status: 502,
        details: result.raw,
      });
    }

    await markAttemptOutcome(db, attempt.id, {
      providerMessageId: result.id,
      apiResponse: result.raw,
      providerStatus: 'Sent',
      deliveryState: 'SUBMITTED',
      submittedAt: new Date().toISOString(),
    });

    // Persist into Phase 1 conversation/message store so Ops inbox sees campaign traffic.
    let craftSquareMessageId: string | undefined;
    try {
      const businessWa = getInteraktBusinessWaNumber();
      if (businessWa) {
        let conversation = await findConversationByPhone(
          db,
          businessWa,
          recipient.normalizedPhone,
        );
        if (!conversation) {
          conversation = await upsertConversationIdentity(db, {
            businessWaNumber: businessWa,
            normalizedPhone: recipient.normalizedPhone,
            customerWaE164: `91${recipient.normalizedPhone}`,
            providerCustomerId: null,
          });
        }
        const now = new Date().toISOString();
        const { message } = await upsertInteraktMessage(db, {
          conversationId: conversation.id,
          providerMessageId: result.id,
          providerCustomerId: conversation.providerCustomerId,
          direction: 'outbound',
          messageType: 'Template',
          bodyText: `Campaign template:${campaign.templateName}`,
          status: 'sent',
          statusTimestamps: { sentAt: now },
          failure: null,
          callbackData,
          normalizedPhone: recipient.normalizedPhone,
          businessWaNumber: businessWa,
          rawMessage: {
            id: result.id,
            message_content_type: 'Template',
            is_template_message: true,
            message_status: 'Sent',
          },
          rawEventType: 'ops_campaign_send',
        });
        craftSquareMessageId = message.id;
        await touchConversationMessageMeta(db, conversation.id, {
          at: now,
          direction: 'outbound',
        });
        await markAttemptOutcome(db, attempt.id, {
          providerMessageId: result.id,
          deliveryState: 'SUBMITTED',
          craftSquareMessageId,
        });
      }
    } catch (persistError) {
      console.warn(
        '[interakt-delivery] inbox_persist_failed',
        persistError instanceof Error ? persistError.message : persistError,
      );
    }

    await transitionRecipientState(db, {
      recipientId: recipient.id,
      to: 'SUBMITTED',
      eventSource: input.eventSource,
      reason: 'interakt_accepted',
      providerMessageId: result.id,
      attemptId: attempt.id,
      currentAttemptId: attempt.id,
      attemptCount: attemptNumber,
      force: true,
    });

    console.info(
      '[interakt-delivery] submitted',
      JSON.stringify({
        campaignId: campaign.id,
        recipientId: recipient.id,
        attemptId: attempt.id,
        attemptNumber,
        providerMessageId: result.id,
        phone: maskPhoneForLog(recipient.normalizedPhone),
      }),
    );

    await reconcileCampaign(db, campaign.id);
    return { ok: true, providerMessageId: result.id, attemptId: attempt.id };
  } catch (error) {
    const httpStatus = (error as { status?: number }).status ?? null;
    const details = (error as { details?: unknown }).details;
    const apiMessage = error instanceof Error ? error.message : 'send_failed';
    const classified = classifyDeliveryFailure({
      httpStatus,
      apiMessage,
      channelFailureReason: apiMessage,
      raw: details,
    });

    const config = getDeliveryRetryConfig();
    const canRetry =
      (classified.failureClass === 'RETRYABLE'
        || (classified.failureClass === 'UNKNOWN' && attemptNumber < config.unknownMaxAttempts))
      && attemptNumber < config.maxAttempts;

    await markAttemptOutcome(db, attempt.id, {
      apiResponse: details ?? { error: apiMessage },
      deliveryState: canRetry ? 'TEMPORARY_FAILURE' : 'PERMANENT_FAILURE',
      failureCode: classified.code,
      failureReason: classified.reason,
      failureClass: classified.failureClass,
      completedAt: canRetry ? null : new Date().toISOString(),
    });

    if (canRetry) {
      const { job } = await scheduleDeliveryRetry(db, {
        campaignId: campaign.id,
        recipientId: recipient.id,
        attemptId: attempt.id,
        normalizedPhone: recipient.normalizedPhone,
        attemptNumber,
      });
      await transitionRecipientState(db, {
        recipientId: recipient.id,
        to: 'RETRY_SCHEDULED',
        eventSource: input.eventSource,
        reason: classified.reason,
        failureClass: classified.failureClass,
        failureCode: classified.code,
        failureReason: classified.reason,
        nextRetryAt: job.scheduledFor,
        attemptId: attempt.id,
        attemptCount: attemptNumber,
        reviewRequired: classified.failureClass === 'UNKNOWN',
        force: true,
      });
    } else {
      await transitionRecipientState(db, {
        recipientId: recipient.id,
        to: 'PERMANENT_FAILURE',
        eventSource: input.eventSource,
        reason: classified.reason,
        failureClass: classified.failureClass === 'RETRYABLE' ? 'PERMANENT' : classified.failureClass,
        failureCode: classified.code,
        failureReason: classified.reason,
        attemptId: attempt.id,
        attemptCount: attemptNumber,
        reviewRequired: classified.failureClass === 'UNKNOWN',
        force: true,
      });
    }

    console.error(
      '[interakt-delivery] submit_failed',
      JSON.stringify({
        campaignId: campaign.id,
        recipientId: recipient.id,
        attemptId: attempt.id,
        failureClass: classified.failureClass,
        reason: classified.reason,
        phone: maskPhoneForLog(recipient.normalizedPhone),
      }),
    );

    await reconcileCampaign(db, campaign.id);
    return { ok: false, reason: classified.reason, attemptId: attempt.id };
  }
}
