/**
 * Per-portal egress proxy resolution.
 *
 * Some portals (99acres/Akamai) block datacenter IP ranges at the edge — every
 * path including robots.txt returns 403/417 regardless of browser fingerprint.
 * The only remedy is routing that portal's traffic through a residential/ISP
 * egress. Configure per portal via env:
 *
 *   RESEARCH_PORTAL_PROXY_99ACRES=http://user:pass@in.residential-proxy.example:8000
 *
 * The env key is RESEARCH_PORTAL_PROXY_ + portal key uppercased with
 * non-alphanumerics stripped (e.g. "99acres" -> 99ACRES). Portals without a
 * configured proxy connect directly, exactly as before.
 *
 * Search-only override (does not affect Connect / OTP headed browsers):
 *   RESEARCH_PORTAL_SEARCH_PROXY_MAGICBRICKS=…
 * MagicBricks www search/validate falls back to the 99acres residential proxy
 * when no MagicBricks-specific proxy is set — accounts.* login stays direct.
 */

export type PortalProxyConfig = {
  server: string;
  username?: string;
  password?: string;
};

function parseProxyUrl(raw: string, envKey: string): PortalProxyConfig | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    const u = new URL(trimmed);
    const proxy: PortalProxyConfig = { server: `${u.protocol}//${u.host}` };
    if (u.username) proxy.username = decodeURIComponent(u.username);
    if (u.password) proxy.password = decodeURIComponent(u.password);
    return proxy;
  } catch {
    console.warn(`[portal-proxy] invalid proxy URL in ${envKey} — ignoring`);
    return undefined;
  }
}

function portalProxyEnvKey(portal: string, prefix: 'RESEARCH_PORTAL_PROXY_' | 'RESEARCH_PORTAL_SEARCH_PROXY_'): string {
  const norm = portal.replace(/[^a-z0-9]/gi, '').toUpperCase();
  return `${prefix}${norm}`;
}

/** Connect / OTP browsers — explicit per-portal proxy only. */
export function resolvePortalProxy(portal: string): PortalProxyConfig | undefined {
  const key = portalProxyEnvKey(portal, 'RESEARCH_PORTAL_PROXY_');
  return parseProxyUrl(process.env[key] || '', key);
}

/**
 * Search / validate pool browsers. MagicBricks www is Akamai-blocked on
 * Railway datacenter egress even with valid SSO cookies; reuse residential
 * scrape.do (99acres) when no dedicated MagicBricks proxy is configured.
 * Connect login on accounts.magicbricks.com stays on resolvePortalProxy().
 */
export function resolvePortalSearchProxy(portal: string): PortalProxyConfig | undefined {
  const searchKey = portalProxyEnvKey(portal, 'RESEARCH_PORTAL_SEARCH_PROXY_');
  const searchOverride = parseProxyUrl(process.env[searchKey] || '', searchKey);
  if (searchOverride) return searchOverride;

  const direct = resolvePortalProxy(portal);
  if (direct) return direct;

  if (portal === 'magicbricks') {
    const fallback = resolvePortalProxy('99acres');
    if (fallback) {
      console.info(
        '[portal-proxy] magicbricks search using RESEARCH_PORTAL_PROXY_99ACRES residential fallback',
      );
    }
    return fallback;
  }
  return undefined;
}
