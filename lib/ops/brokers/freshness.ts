import { BROKER_FRESHNESS_CONFIG } from '@/lib/ops/brokers/config';
import type { BrokerFreshnessStatus } from '@/lib/ops/brokers/statuses';

export function computeFreshnessStatus(
  lastSeenAt: string | Date,
  now: Date = new Date(),
): BrokerFreshnessStatus {
  const seen = typeof lastSeenAt === 'string' ? new Date(lastSeenAt) : lastSeenAt;
  if (Number.isNaN(seen.getTime())) return 'STALE';

  const diffMs = now.getTime() - seen.getTime();
  const days = diffMs / (1000 * 60 * 60 * 24);

  if (days <= BROKER_FRESHNESS_CONFIG.freshMaxDays) return 'FRESH';
  if (days <= BROKER_FRESHNESS_CONFIG.agingMaxDays) return 'AGING';
  return 'STALE';
}

export function daysSince(lastSeenAt: string | Date, now: Date = new Date()): number {
  const seen = typeof lastSeenAt === 'string' ? new Date(lastSeenAt) : lastSeenAt;
  if (Number.isNaN(seen.getTime())) return Number.POSITIVE_INFINITY;
  return (now.getTime() - seen.getTime()) / (1000 * 60 * 60 * 24);
}
