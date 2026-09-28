/**
 * CraftSquare Meta Ads dry-run configuration.
 * Spend is NEVER enabled unless META_ADS_ALLOW_ACTIVE=true (default false).
 */

export const META_ADS_DEFAULTS = {
  businessId: '142029732004538',
  adAccountId: '1947289589273795',
  pixelId: '1391594993119180',
  pageId: '1351127224742253',
} as const;

export function getMetaAdsBusinessId(): string {
  return process.env.META_BUSINESS_ID?.trim() || META_ADS_DEFAULTS.businessId;
}

export function getMetaAdsAdAccountId(): string {
  const raw = process.env.META_AD_ACCOUNT_ID?.trim() || META_ADS_DEFAULTS.adAccountId;
  return raw.startsWith('act_') ? raw : `act_${raw}`;
}

export function getMetaAdsPageId(): string {
  return process.env.META_PAGE_ID?.trim() || META_ADS_DEFAULTS.pageId;
}

export function getMetaAdsPixelId(): string {
  return (
    process.env.META_PIXEL_ID?.trim()
    || process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim()
    || META_ADS_DEFAULTS.pixelId
  );
}

export function getMetaAdsGraphVersion(): string {
  const raw = process.env.META_GRAPH_API_VERSION?.trim();
  if (raw && /^v\d+\.\d+$/.test(raw)) return raw;
  return 'v22.0';
}

export function getMetaAdsAccessToken(): string | null {
  return (
    process.env.META_ADS_ACCESS_TOKEN?.trim()
    || process.env.META_ACCESS_TOKEN?.trim()
    || null
  );
}

/** Hard safety: Active spend is blocked unless this is explicitly true. */
export function isMetaAdsActiveSpendAllowed(): boolean {
  return process.env.META_ADS_ALLOW_ACTIVE?.trim() === 'true';
}

export function getMetaAdsDefaultDailyBudgetInr(): number {
  const n = Number(process.env.META_ADS_DRY_RUN_DAILY_BUDGET_INR || '500');
  return Number.isFinite(n) && n > 0 ? Math.min(n, 5000) : 500;
}
