/**
 * Lightweight operational alerts for delivery engine (no secrets).
 */
import type { Db } from 'mongodb';
import { INTERAKT_DELIVERY_RETRIES_COLLECTION } from '@/lib/interakt/delivery/retry-scheduler';
import { OPS_WA_CAMPAIGNS_COLLECTION, OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION } from '@/lib/ops/campaigns/store';

export type DeliveryAlert = {
  severity: 'info' | 'warning' | 'critical';
  code: string;
  message: string;
  count?: number;
};

export async function collectDeliveryAlerts(db: Db): Promise<DeliveryAlert[]> {
  const alerts: DeliveryAlert[] = [];
  const now = new Date().toISOString();

  const retryBacklog = await db.collection(INTERAKT_DELIVERY_RETRIES_COLLECTION).countDocuments({
    status: 'queued',
    scheduledFor: { $lte: now },
  });
  if (retryBacklog > 50) {
    alerts.push({
      severity: 'critical',
      code: 'retry_backlog',
      message: 'Large delivery retry backlog',
      count: retryBacklog,
    });
  } else if (retryBacklog > 10) {
    alerts.push({
      severity: 'warning',
      code: 'retry_backlog',
      message: 'Elevated delivery retry backlog',
      count: retryBacklog,
    });
  }

  const unknown = await db.collection(OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION).countDocuments({
    deliveryState: 'UNKNOWN',
  });
  if (unknown > 0) {
    alerts.push({
      severity: 'warning',
      code: 'unknown_failures',
      message: 'Recipients with unknown failure classification need review',
      count: unknown,
    });
  }

  const stuck = await db.collection(OPS_WA_CAMPAIGNS_COLLECTION).countDocuments({
    status: { $in: ['waiting_for_delivery', 'retrying', 'running'] },
    updatedAt: { $lte: new Date(Date.now() - 6 * 60 * 60_000).toISOString() },
  });
  if (stuck > 0) {
    alerts.push({
      severity: 'warning',
      code: 'campaign_stuck',
      message: 'Campaigns idle in non-terminal state for >6h',
      count: stuck,
    });
  }

  const permanentSpike = await db.collection(OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION).countDocuments({
    deliveryState: 'PERMANENT_FAILURE',
    updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60_000).toISOString() },
  });
  if (permanentSpike > 20) {
    alerts.push({
      severity: 'warning',
      code: 'permanent_failure_spike',
      message: 'Elevated permanent failures in last 24h',
      count: permanentSpike,
    });
  }

  return alerts;
}
