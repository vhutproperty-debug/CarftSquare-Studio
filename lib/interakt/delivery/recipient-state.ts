import type { Db } from 'mongodb';
import {
  deliveryStateToLegacyStatus,
  isTerminalDeliveryState,
  shouldApplyDeliveryState,
} from '@/lib/interakt/delivery/state-machine';
import { recordDeliveryTransition } from '@/lib/interakt/delivery/transitions';
import type {
  DeliveryEventSource,
  DeliveryState,
  FailureClass,
} from '@/lib/interakt/delivery/types';
import { OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION } from '@/lib/ops/campaigns/store';

export type DeliveryRecipientDoc = {
  id: string;
  campaignId: string;
  phone: string;
  normalizedPhone: string;
  status: string;
  deliveryState?: DeliveryState;
  providerMessageId?: string;
  lastError?: string;
  attemptCount?: number;
  failureClass?: FailureClass | null;
  failureCode?: string | null;
  failureReason?: string | null;
  nextRetryAt?: string | null;
  currentAttemptId?: string | null;
  doNotContact?: boolean;
  reviewRequired?: boolean;
  lastProviderEventId?: string | null;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
};

export async function getDeliveryRecipient(
  db: Db,
  recipientId: string,
): Promise<DeliveryRecipientDoc | null> {
  return (await db.collection(OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION).findOne(
    { id: recipientId },
    { projection: { _id: 0 } },
  )) as unknown as DeliveryRecipientDoc | null;
}

export async function transitionRecipientState(
  db: Db,
  input: {
    recipientId: string;
    to: DeliveryState;
    eventSource: DeliveryEventSource;
    reason?: string | null;
    attemptId?: string;
    providerMessageId?: string | null;
    providerEventId?: string | null;
    retryAttempt?: number | null;
    failureClass?: FailureClass | null;
    failureCode?: string | null;
    failureReason?: string | null;
    nextRetryAt?: string | null;
    doNotContact?: boolean;
    reviewRequired?: boolean;
    attemptCount?: number;
    currentAttemptId?: string | null;
    metadata?: Record<string, unknown>;
    force?: boolean;
  },
): Promise<{ applied: boolean; previous: DeliveryState | null; recipient: DeliveryRecipientDoc | null }> {
  const current = await getDeliveryRecipient(db, input.recipientId);
  if (!current) return { applied: false, previous: null, recipient: null };

  const previous = (current.deliveryState
    || legacyStatusToDeliveryState(current.status)
    || 'QUEUED') as DeliveryState;

  if (!input.force && !shouldApplyDeliveryState(previous, input.to)) {
    return { applied: false, previous, recipient: current };
  }

  // Idempotent webhook: same provider event already applied
  if (
    input.providerEventId
    && current.lastProviderEventId
    && current.lastProviderEventId === input.providerEventId
  ) {
    return { applied: false, previous, recipient: current };
  }

  const now = new Date().toISOString();
  const legacy = deliveryStateToLegacyStatus(input.to);
  const setDoc: Record<string, unknown> = {
    deliveryState: input.to,
    status: legacy,
    updatedAt: now,
  };
  if (input.providerMessageId !== undefined) setDoc.providerMessageId = input.providerMessageId;
  if (input.failureClass !== undefined) setDoc.failureClass = input.failureClass;
  if (input.failureCode !== undefined) setDoc.failureCode = input.failureCode;
  if (input.failureReason !== undefined) {
    setDoc.failureReason = input.failureReason;
    setDoc.lastError = input.failureReason;
  }
  if (input.nextRetryAt !== undefined) setDoc.nextRetryAt = input.nextRetryAt;
  if (input.doNotContact !== undefined) setDoc.doNotContact = input.doNotContact;
  if (input.reviewRequired !== undefined) setDoc.reviewRequired = input.reviewRequired;
  if (input.attemptCount !== undefined) setDoc.attemptCount = input.attemptCount;
  if (input.currentAttemptId !== undefined) setDoc.currentAttemptId = input.currentAttemptId;
  if (input.providerEventId) setDoc.lastProviderEventId = input.providerEventId;

  const filter: Record<string, unknown> = { id: input.recipientId };
  if (!input.force && previous) {
    // Optimistic concurrency: only update if deliveryState still matches (or unset for legacy)
    filter.$or = [
      { deliveryState: previous },
      { deliveryState: { $exists: false }, status: current.status },
    ];
  }

  const result = await db.collection(OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION).findOneAndUpdate(
    filter,
    { $set: setDoc },
    { returnDocument: 'after', projection: { _id: 0 } },
  );

  if (!result) {
    const fresh = await getDeliveryRecipient(db, input.recipientId);
    return { applied: false, previous, recipient: fresh };
  }

  const recipient = result as unknown as DeliveryRecipientDoc;
  if (previous !== input.to) {
    await recordDeliveryTransition(db, {
      campaignId: recipient.campaignId,
      recipientId: recipient.id,
      attemptId: input.attemptId,
      previousState: previous,
      newState: input.to,
      eventSource: input.eventSource,
      providerMessageId: input.providerMessageId,
      providerEventId: input.providerEventId,
      reason: input.reason,
      retryAttempt: input.retryAttempt,
      metadata: input.metadata,
    });
  }

  return { applied: true, previous, recipient };
}

export function legacyStatusToDeliveryState(status: string): DeliveryState {
  switch (status) {
    case 'queued':
      return 'QUEUED';
    case 'sending':
      return 'SUBMITTING';
    case 'sent':
      return 'SENT';
    case 'delivered':
      return 'DELIVERED';
    case 'read':
      return 'READ';
    case 'failed':
      return 'PERMANENT_FAILURE';
    case 'skipped_opt_out':
    case 'skipped_invalid':
      return 'CANCELLED';
    default:
      return 'QUEUED';
  }
}

export function recipientIsTerminal(recipient: DeliveryRecipientDoc): boolean {
  const state = recipient.deliveryState || legacyStatusToDeliveryState(recipient.status);
  return isTerminalDeliveryState(state);
}
