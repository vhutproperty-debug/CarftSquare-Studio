import { metaAdsGraph } from '@/lib/meta-ads/client';
import { isMetaAdsActiveSpendAllowed, isMetaAdsPublishEnabled } from '@/lib/meta-ads/config';

export async function updateMetaObjectStatus(input: {
  objectId: string;
  status: 'PAUSED' | 'ACTIVE';
  allowActive: boolean;
}) {
  if (!isMetaAdsPublishEnabled()) {
    throw Object.assign(new Error('META_ADS_ENABLED is false. Refusing to change live ads.'), { status: 409 });
  }
  const status = input.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED';
  if (status === 'ACTIVE' && !(input.allowActive && isMetaAdsActiveSpendAllowed())) {
    throw Object.assign(new Error('ACTIVE is locked. Set META_ADS_ALLOW_ACTIVE=true and use an admin role.'), { status: 403 });
  }
  return metaAdsGraph<{ success?: boolean }>(`/${input.objectId}`, {
    method: 'POST',
    body: { status },
  });
}

export async function updateMetaDailyBudget(input: { objectId: string; dailyBudgetInr: number }) {
  if (!isMetaAdsPublishEnabled()) {
    throw Object.assign(new Error('META_ADS_ENABLED is false. Refusing budget changes.'), { status: 409 });
  }
  const budget = Math.round(Math.min(Math.max(input.dailyBudgetInr, 100), 5000) * 100);
  return metaAdsGraph<{ success?: boolean }>(`/${input.objectId}`, {
    method: 'POST',
    body: { daily_budget: String(budget) },
  });
}
