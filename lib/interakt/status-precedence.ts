import type { InteraktMessageStatus } from '@/lib/interakt/types';

const SUCCESS_RANK: Record<Exclude<InteraktMessageStatus, 'failed'>, number> = {
  received: 0,
  queued: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

/**
 * Deterministic status application.
 * Higher success ranks win. Failed may replace sent/queued/received/failed,
 * but never overwrites delivered or read. A later success may replace failed.
 */
export function shouldApplyMessageStatus(
  current: InteraktMessageStatus,
  incoming: InteraktMessageStatus,
): boolean {
  if (current === incoming) return true;

  if (incoming === 'failed') {
    if (current === 'delivered' || current === 'read') return false;
    return true;
  }

  if (current === 'failed') {
    return SUCCESS_RANK[incoming] >= SUCCESS_RANK.sent;
  }

  return SUCCESS_RANK[incoming] >= SUCCESS_RANK[current];
}

export function mapInteraktEventToStatus(eventType: string): InteraktMessageStatus | null {
  switch (eventType) {
    case 'message_received':
      return 'received';
    case 'message_api_sent':
      return 'sent';
    case 'message_api_delivered':
      return 'delivered';
    case 'message_api_read':
      return 'read';
    case 'message_api_failed':
      return 'failed';
    default:
      return null;
  }
}

export function mapProviderMessageStatus(raw?: string | null): InteraktMessageStatus | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  if (value === 'sent') return 'sent';
  if (value === 'delivered') return 'delivered';
  if (value === 'read' || value === 'seen') return 'read';
  if (value === 'failed') return 'failed';
  if (value === 'received') return 'received';
  return null;
}
