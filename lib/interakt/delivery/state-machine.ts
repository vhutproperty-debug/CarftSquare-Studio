import type { DeliveryState } from '@/lib/interakt/delivery/types';
import { TERMINAL_DELIVERY_STATES } from '@/lib/interakt/delivery/types';

/**
 * Explicit allowed transitions. Arbitrary mutation is rejected.
 */
const ALLOWED: Record<DeliveryState, DeliveryState[]> = {
  QUEUED: ['SUBMITTING', 'CANCELLED', 'PERMANENT_FAILURE'],
  SUBMITTING: ['SUBMITTED', 'TEMPORARY_FAILURE', 'PERMANENT_FAILURE', 'UNKNOWN', 'CANCELLED'],
  SUBMITTED: ['ACCEPTED', 'PENDING', 'SENT', 'DELIVERED', 'READ', 'TEMPORARY_FAILURE', 'PERMANENT_FAILURE', 'UNKNOWN'],
  ACCEPTED: ['PENDING', 'SENT', 'DELIVERED', 'READ', 'TEMPORARY_FAILURE', 'PERMANENT_FAILURE', 'UNKNOWN'],
  PENDING: ['SENT', 'DELIVERED', 'READ', 'TEMPORARY_FAILURE', 'PERMANENT_FAILURE', 'UNKNOWN', 'RETRY_SCHEDULED'],
  SENT: ['DELIVERED', 'READ', 'TEMPORARY_FAILURE', 'PERMANENT_FAILURE', 'UNKNOWN', 'RETRY_SCHEDULED'],
  DELIVERED: ['READ'],
  READ: [],
  TEMPORARY_FAILURE: ['RETRY_SCHEDULED', 'PERMANENT_FAILURE', 'CANCELLED', 'RETRYING', 'DELIVERED', 'READ', 'SENT'],
  RETRY_SCHEDULED: ['RETRYING', 'CANCELLED', 'DELIVERED', 'READ', 'SENT', 'PERMANENT_FAILURE'],
  RETRYING: ['SUBMITTING', 'CANCELLED', 'PERMANENT_FAILURE', 'TEMPORARY_FAILURE', 'DELIVERED', 'READ', 'SENT', 'SUBMITTED'],
  PERMANENT_FAILURE: [],
  CANCELLED: [],
  UNKNOWN: ['RETRY_SCHEDULED', 'PERMANENT_FAILURE', 'CANCELLED', 'DELIVERED', 'READ', 'SENT', 'SUBMITTED'],
};

/** Success-ish ranks for webhook racing — higher wins among provider statuses. */
const PROVIDER_RANK: Partial<Record<DeliveryState, number>> = {
  SUBMITTED: 1,
  ACCEPTED: 2,
  PENDING: 2,
  SENT: 3,
  DELIVERED: 4,
  READ: 5,
};

export function isTerminalDeliveryState(state: DeliveryState): boolean {
  return TERMINAL_DELIVERY_STATES.includes(state);
}

export function canTransition(from: DeliveryState, to: DeliveryState): boolean {
  if (from === to) return true;
  return (ALLOWED[from] || []).includes(to);
}

/**
 * Decide whether an incoming provider status should apply over current state.
 * Delivered/read never lose to failure. Failure never overwrites delivered/read.
 */
export function shouldApplyDeliveryState(
  current: DeliveryState,
  incoming: DeliveryState,
): boolean {
  if (current === incoming) return true;
  if (!canTransition(current, incoming) && !isProviderUpgrade(current, incoming)) {
    // Allow provider upgrades even if not listed when racing (e.g. SENT→DELIVERED always ok)
    if (!isProviderUpgrade(current, incoming) && !isFailureOverwrite(current, incoming)) {
      return false;
    }
  }

  if (incoming === 'TEMPORARY_FAILURE' || incoming === 'PERMANENT_FAILURE' || incoming === 'UNKNOWN') {
    if (current === 'DELIVERED' || current === 'READ') return false;
  }

  if (current === 'TEMPORARY_FAILURE' || current === 'PERMANENT_FAILURE' || current === 'UNKNOWN') {
    const rank = PROVIDER_RANK[incoming];
    if (rank && rank >= (PROVIDER_RANK.SENT || 3)) return true;
  }

  if (isProviderUpgrade(current, incoming)) return true;
  return canTransition(current, incoming);
}

function isProviderUpgrade(current: DeliveryState, incoming: DeliveryState): boolean {
  const a = PROVIDER_RANK[current];
  const b = PROVIDER_RANK[incoming];
  if (a == null || b == null) return false;
  return b >= a;
}

function isFailureOverwrite(current: DeliveryState, incoming: DeliveryState): boolean {
  if (!(incoming === 'TEMPORARY_FAILURE' || incoming === 'PERMANENT_FAILURE' || incoming === 'UNKNOWN')) {
    return false;
  }
  return ['SUBMITTED', 'ACCEPTED', 'PENDING', 'SENT', 'SUBMITTING', 'RETRYING'].includes(current);
}

export function mapInteraktStatusToDeliveryState(
  status: string,
): DeliveryState | null {
  switch (status) {
    case 'queued':
      return 'PENDING';
    case 'sent':
      return 'SENT';
    case 'delivered':
      return 'DELIVERED';
    case 'read':
      return 'READ';
    case 'failed':
      return 'TEMPORARY_FAILURE'; // refined by classifier
    case 'received':
      return null;
    default:
      return null;
  }
}

/** Sync legacy campaign recipient.status from deliveryState */
export function deliveryStateToLegacyStatus(
  state: DeliveryState,
): 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'skipped_opt_out' | 'skipped_invalid' {
  switch (state) {
    case 'QUEUED':
      return 'queued';
    case 'SUBMITTING':
    case 'RETRYING':
      return 'sending';
    case 'SUBMITTED':
    case 'ACCEPTED':
    case 'PENDING':
    case 'SENT':
    case 'RETRY_SCHEDULED':
    case 'TEMPORARY_FAILURE':
    case 'UNKNOWN':
      return 'sent';
    case 'DELIVERED':
      return 'delivered';
    case 'READ':
      return 'read';
    case 'PERMANENT_FAILURE':
      return 'failed';
    case 'CANCELLED':
      return 'failed';
    default:
      return 'queued';
  }
}
