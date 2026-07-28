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
 */

export type PortalProxyConfig = {
  server: string;
  username?: string;
  password?: string;
};

export function resolvePortalProxy(portal: string): PortalProxyConfig | undefined {
  const norm = portal.replace(/[^a-z0-9]/gi, '').toUpperCase();
  const raw = (process.env[`RESEARCH_PORTAL_PROXY_${norm}`] || '').trim();
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    const proxy: PortalProxyConfig = { server: `${u.protocol}//${u.host}` };
    if (u.username) proxy.username = decodeURIComponent(u.username);
    if (u.password) proxy.password = decodeURIComponent(u.password);
    return proxy;
  } catch {
    console.warn(
      `[portal-proxy] invalid proxy URL in RESEARCH_PORTAL_PROXY_${norm} — ignoring`,
    );
    return undefined;
  }
}
