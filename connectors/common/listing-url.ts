/**
 * Portal listing URL allow/deny rules.
 *
 * Prop AI (and Research) must only receive property detail URLs — never
 * nav, marketing, utility, or city-landing pages harvested from page chrome.
 */

const GLOBAL_NAV_DENY_RE =
  /list-your-property|post-your-property|post-property|rental-agreement|rent-agreement|buyer\/plans|online-property-valuation|property-valuation|buy-vs-rent|\/guide\/|property-for-sale-in-|property-for-rent-in-|property-rates-in-|pay-property-rent|emi-calculator|home-loan|packers|tenant-verification|legal-services|owner-plans|seller-plans|broker-plans|\/owners(?:\/|$)|\/dashboard(?:\/|$)/i;

function stripUrl(raw: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed || trimmed.startsWith('javascript:')) return '';
  try {
    const u = new URL(trimmed);
    u.hash = '';
    return u.toString();
  } catch {
    return trimmed.split('#')[0] || '';
  }
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname.replace(/\/+$/, '') || '/';
  } catch {
    return '';
  }
}

function pathSegments(url: string): string[] {
  return pathOf(url).split('/').filter(Boolean);
}

/** NoBroker detail: /property/{rent|sale|buy}/{city}/{locality}/…/{id} (≥5 segments). */
export function isNobrokerListingUrl(url: string): boolean {
  if (!/nobroker\.in/i.test(url)) return false;
  if (/_search-list|list-your-property|\/owners\b/i.test(url)) return false;
  const path = pathOf(url);
  // Reject SERP shells: /property/rent/{city} or /property/rent/{city}/{locality}
  const m = path.match(/^\/property\/(rent|sale|buy)\/([^/]+)\/([^/]+)\/(.+)$/i);
  if (!m) return false;
  const rest = m[4];
  if (!rest || /search-list/i.test(rest)) return false;
  // Final token should look like a listing id (hex / alphanumeric), not a bare slug landing.
  const last = rest.split('/').filter(Boolean).pop() || '';
  if (last.length < 6) return false;
  return true;
}

/**
 * SquareYards detail examples:
 *   /rent/2-bhk-apartment-for-rent-in-andheri-west-mumbai-123456
 *   /sale/property/…-{id}
 * Reject bare /rent, city landings, valuation/guides.
 */
export function isSquareyardsListingUrl(url: string): boolean {
  if (!/squareyards\.com/i.test(url)) return false;
  const path = pathOf(url);
  if (/^\/(rent|sale|buy)$/i.test(path)) return false;
  if (/property-for-(?:sale|rent)-in-/i.test(path)) return false;
  if (/property-rates-in-|online-property|buy-vs-rent|\/guide\//i.test(path)) return false;

  if (/^\/rent\//i.test(path)) {
    return /-\d{5,}(?:\/)?$/i.test(path) || /\/\d{5,}(?:\/)?$/i.test(path);
  }
  if (/^\/sale\/property\//i.test(path)) {
    if (/property-for-sale-in-/i.test(path)) return false;
    if (/-\d{5,}(?:\/)?$/i.test(path) || /\/\d{5,}(?:\/)?$/i.test(path)) return true;
    return pathSegments(url).length >= 4;
  }
  if (/^\/properties\//i.test(path)) {
    return /-\d{5,}|\d{5,}/i.test(path);
  }
  return false;
}

/** Housing genuine rent detail (existing product pattern) + pid variants. */
export function isHousingListingUrl(url: string): boolean {
  if (!/housing\.com/i.test(url)) return false;
  if (
    /\/(?:buy|commercial)\b|-(?:gid|fid)\/|\/projects\/page\/|flats-for-rent-in-|flat-for-rent-in-.*-AG/i.test(
      url,
    )
  ) {
    return false;
  }
  if (/\/rent\/\d{5,}-\d+(?:\.\d+)?-sqft-[\d.]+-bhk-/i.test(url)) return true;
  if (/\/in\/(?:rent|buy)\/.+/i.test(url) && /(?:-pid-|-\d{6,})/i.test(url)) return true;
  if (/-pid-\d+/i.test(url)) return true;
  return false;
}

export function isMagicbricksListingUrl(url: string): boolean {
  if (!/magicbricks\.com/i.test(url)) return false;
  // SERP shells without a detail id
  if (/property-for-(?:rent|sale)\//i.test(url) && !/propertyDetails|-ppid-/i.test(url)) {
    return false;
  }
  return /propertyDetails\/|-ppid-/i.test(url);
}

export function isNinetyNineAcresListingUrl(url: string): boolean {
  if (!/99acres\.com/i.test(url)) return false;
  if (/\/search\/property\//i.test(url)) return false;
  return /-spid-|-npsid-|-pdetails(?:\/|$|\?)/i.test(url);
}

/**
 * Returns true only when `url` is a portal property detail page for `portal`.
 * Rows without a genuine listing URL must be omitted by callers.
 */
export function isGenuineListingUrl(portal: string, rawUrl: string | null | undefined): boolean {
  const url = stripUrl(String(rawUrl || ''));
  if (!url) return false;
  if (GLOBAL_NAV_DENY_RE.test(url)) return false;

  switch (String(portal || '')
    .trim()
    .toLowerCase()) {
    case 'nobroker':
      return isNobrokerListingUrl(url);
    case 'squareyards':
      return isSquareyardsListingUrl(url);
    case 'housing':
      return isHousingListingUrl(url);
    case 'magicbricks':
      return isMagicbricksListingUrl(url);
    case '99acres':
      return isNinetyNineAcresListingUrl(url);
    default:
      return false;
  }
}

/** Keep only listings whose url is a genuine property detail page. */
export function filterGenuineListingUrls<T extends { url?: string | null }>(
  portal: string,
  listings: T[],
): T[] {
  return (listings || []).filter((row) => isGenuineListingUrl(portal, row.url));
}

/** Best-effort locality from a NoBroker detail path. */
export function localityFromNobrokerUrl(url: string): string | undefined {
  const m = pathOf(url).match(/^\/property\/(?:rent|sale|buy)\/[^/]+\/([^/]+)\//i);
  if (!m?.[1]) return undefined;
  return decodeURIComponent(m[1]).replace(/[-_]+/g, ' ').trim();
}
