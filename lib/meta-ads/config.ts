/**
 * CraftSquare Meta Ads configuration.
 * Spend is NEVER enabled unless META_ADS_ALLOW_ACTIVE=true (default false).
 * Publishing stays off until META_ADS_ENABLED=true.
 */
import {
  getMetaAdAccountId,
  getMetaBusinessId,
  getMetaGraphApiVersion,
  getMetaPageId,
  getMetaSystemUserToken,
  isMetaAdsEnabled,
} from '@/lib/meta/config';

export const META_ADS_DEFAULTS = {
  businessId: '1420297320045438',
  adAccountId: '1947289589273795',
  pixelId: '1391594993119180',
  pageId: '1351127224742253',
} as const;

export function getMetaAdsBusinessId(): string {
  return getMetaBusinessId();
}

export function getMetaAdsAdAccountId(): string {
  return getMetaAdAccountId();
}

export function getMetaAdsPageId(): string {
  return getMetaPageId();
}

export function getMetaAdsPixelId(): string {
  return (
    process.env.META_PIXEL_ID?.trim()
    || process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim()
    || META_ADS_DEFAULTS.pixelId
  );
}

export function getMetaAdsGraphVersion(): string {
  return getMetaGraphApiVersion();
}

/** System user token first. Never the Conversions API dataset token. */
export function getMetaAdsAccessToken(): string | null {
  return getMetaSystemUserToken() || process.env.META_ADS_ACCESS_TOKEN?.trim() || null;
}

export function isMetaAdsPublishEnabled(): boolean {
  return isMetaAdsEnabled();
}

/** Hard safety: Active spend is blocked unless this is explicitly true. */
export function isMetaAdsActiveSpendAllowed(): boolean {
  return process.env.META_ADS_ALLOW_ACTIVE?.trim() === 'true';
}

export function getMetaAdsDefaultDailyBudgetInr(): number {
  const n = Number(process.env.META_ADS_DRY_RUN_DAILY_BUDGET_INR || '500');
  return Number.isFinite(n) && n > 0 ? Math.min(n, 5000) : 500;
}
