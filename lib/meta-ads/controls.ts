import { metaAdsGraph } from '@/lib/meta-ads/client';
import { isMetaAdsActiveSpendAllowed, isMetaAdsPublishEnabled } from '@/lib/meta-ads/config';
import {
  RESUME_BLOCKED_ACTIVE_LOCKED,
  RESUME_BLOCKED_ADMIN,
  RESUME_BLOCKED_ADS_DISABLED,
} from '@/lib/meta-ads/messages';

function reject(message: string, status: number): never {
  throw Object.assign(new Error(message), { status });
}

/**
 * Pause always reaches Graph. Resume stays behind META_ADS_ENABLED,
 * META_ADS_ALLOW_ACTIVE, and an admin role.
 */
export async function updateMetaObjectStatus(input: {
  objectId: string;
  status: 'PAUSED' | 'ACTIVE';
  allowActive: boolean;
}) {
  const objectId = input.objectId.trim();
  if (!/^\d+$/.test(objectId)) {
    reject('Campaign id must be a Meta object id.', 400);
  }
  const status = input.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED';
  if (status === 'ACTIVE') {
    if (!isMetaAdsPublishEnabled()) reject(RESUME_BLOCKED_ADS_DISABLED, 409);
    if (!isMetaAdsActiveSpendAllowed()) reject(RESUME_BLOCKED_ACTIVE_LOCKED, 403);
    if (!input.allowActive) reject(RESUME_BLOCKED_ADMIN, 403);
  }
  return metaAdsGraph<{ success?: boolean }>(`/${objectId}`, {
    method: 'POST',
    body: { status },
  });
}

export async function updateMetaDailyBudget(input: { objectId: string; dailyBudgetInr: number }) {
  if (!isMetaAdsPublishEnabled()) {
    throw Object.assign(new Error('META_ADS_ENABLED is false. Refusing budget changes.'), { status: 409 });
  }
  const objectId = input.objectId.trim();
  if (!/^\d+$/.test(objectId)) {
    reject('Campaign id must be a Meta object id.', 400);
  }
  const budget = Math.round(Math.min(Math.max(input.dailyBudgetInr, 100), 5000) * 100);
  return metaAdsGraph<{ success?: boolean }>(`/${objectId}`, {
    method: 'POST',
    body: { daily_budget: String(budget) },
  });
}
