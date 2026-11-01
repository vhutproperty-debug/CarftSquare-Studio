/**
 * Single source for Meta app / Graph configuration.
 * Marketing API publish stays off until META_ADS_ENABLED=true.
 */

const VERSION_PATTERN = /^v\d+\.\d+$/;

export const META_DEFAULTS = {
  businessId: '1420297320045438',
  adAccountId: '1947289589273795',
  pageId: '1351127224742253',
  pixelId: '1391594993119180',
  graphApiVersion: 'v22.0',
} as const;

export const REQUIRED_ADS_PERMISSIONS = [
  'ads_management',
  'ads_read',
  'pages_manage_ads',
  'pages_read_engagement',
  'pages_show_list',
  'leads_retrieval',
  'pages_manage_metadata',
  'business_management',
] as const;

export function getMetaGraphApiVersion(): string {
  const raw = process.env.META_GRAPH_API_VERSION?.trim();
  if (raw && VERSION_PATTERN.test(raw)) return raw;
  return META_DEFAULTS.graphApiVersion;
}

export function getMetaAppSecret(): string {
  return String(process.env.META_APP_SECRET || process.env.WHATSAPP_APP_SECRET || '').trim();
}

export function getMetaSystemUserToken(): string {
  return String(process.env.META_SYSTEM_USER_TOKEN || '').trim();
}

export function getMetaPageId(): string {
  return process.env.META_PAGE_ID?.trim() || META_DEFAULTS.pageId;
}

/** Page token for lead retrieval. Never the Conversions API dataset token. */
export function getMetaPageAccessToken(): string {
  return String(
    process.env.META_PAGE_ACCESS_TOKEN
    || process.env.META_LEAD_ADS_PAGE_TOKEN
    || '',
  ).trim();
}

export function getLeadRetrievalToken(): string {
  return getMetaPageAccessToken() || getMetaSystemUserToken();
}

export function getMetaBusinessId(): string {
  return process.env.META_BUSINESS_ID?.trim() || META_DEFAULTS.businessId;
}

export function getMetaAdAccountId(): string {
  const raw = process.env.META_AD_ACCOUNT_ID?.trim() || META_DEFAULTS.adAccountId;
  return raw.startsWith('act_') ? raw : `act_${raw}`;
}

/** Lead pipeline (CRM + WhatsApp + owner alert). On unless explicitly disabled. */
export function isMetaLeadsEnabled(): boolean {
  return process.env.META_LEADS_ENABLED?.trim() !== 'false';
}

/** Marketing API writes. Off until App Review grants ads permissions. */
export function isMetaAdsEnabled(): boolean {
  return process.env.META_ADS_ENABLED?.trim() === 'true';
}

export function graphUrl(path: string, token?: string): string {
  const version = getMetaGraphApiVersion();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const sep = normalized.includes('?') ? '&' : '?';
  const base = `https://graph.facebook.com/${version}${normalized}`;
  if (!token) return base;
  return `${base}${sep}access_token=${encodeURIComponent(token)}`;
}
