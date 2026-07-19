import {
  getResearchProfileRoot,
  getResearchScreenshotRoot,
} from '@/lib/research/browser/runtime-paths';

export const RESEARCH_BROWSER_CONFIG = {
  // Default headed: Housing.com (Akamai) returns HTTP 406 "Security Alert" to headless Chromium.
  // Set RESEARCH_BROWSER_HEADLESS=true only behind a provider that passes bot checks.
  headless: process.env.RESEARCH_BROWSER_HEADLESS === 'true',
  defaultTimeoutMs: Number(process.env.RESEARCH_BROWSER_TIMEOUT_MS || 45_000),
  navigationTimeoutMs: Number(process.env.RESEARCH_BROWSER_NAV_TIMEOUT_MS || 60_000),
  // Default covers all five portals for parallel AI search without cold relaunch thrash.
  maxPoolSize: Number(process.env.RESEARCH_BROWSER_POOL_SIZE || 5),
  maxRetries: Number(process.env.RESEARCH_BROWSER_RETRIES || 2),
  /** Writable profile root (resolved at access time — never `/var/task`). */
  get profileRoot() {
    return getResearchProfileRoot();
  },
  /** Writable screenshot root (resolved at access time). */
  get screenshotRoot() {
    return getResearchScreenshotRoot();
  },
  sessionTtlMs: Number(process.env.RESEARCH_SESSION_TTL_MS || 7 * 24 * 60 * 60 * 1000),
  /** Skip live browser validation when lastVerified is newer than this (ms). */
  validateFreshMs: Number(process.env.RESEARCH_VALIDATE_FRESH_MS || 10 * 60 * 1000),
  /** Skip post-search cookie renew when lastVerified is newer than this (ms). */
  renewMinIntervalMs: Number(process.env.RESEARCH_RENEW_MIN_INTERVAL_MS || 15 * 60 * 1000),
  /** Block images/fonts/media/trackers on automation contexts (not login adapters). */
  blockHeavyResources: process.env.RESEARCH_BROWSER_BLOCK_RESOURCES !== 'false',
};

export type ResearchPortalKey =
  | 'housing'
  | 'magicbricks'
  | '99acres'
  | 'nobroker'
  | 'squareyards';

export const RESEARCH_PORTALS: Array<{
  key: ResearchPortalKey;
  displayName: string;
  origin: string;
  loginUrl: string;
}> = [
  {
    key: 'housing',
    displayName: 'Housing.com',
    origin: 'https://housing.com',
    loginUrl: 'https://housing.com/user-profile',
  },
  {
    key: 'magicbricks',
    displayName: 'MagicBricks',
    origin: 'https://www.magicbricks.com',
    loginUrl: 'https://www.magicbricks.com/userProfile',
  },
  {
    key: '99acres',
    displayName: '99acres',
    origin: 'https://www.99acres.com',
    loginUrl: 'https://www.99acres.com/myaccount',
  },
  {
    key: 'nobroker',
    displayName: 'NoBroker',
    origin: 'https://www.nobroker.in',
    loginUrl: 'https://www.nobroker.in/profile',
  },
  {
    key: 'squareyards',
    displayName: 'Square Yards',
    origin: 'https://www.squareyards.com',
    loginUrl: 'https://www.squareyards.com/account',
  },
];

const PORTAL_META_BY_KEY = new Map(RESEARCH_PORTALS.map((p) => [p.key, p]));

export function getPortalMeta(portal: string) {
  return PORTAL_META_BY_KEY.get(portal as ResearchPortalKey);
}
