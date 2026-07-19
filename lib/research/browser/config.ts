import path from 'path';

export const RESEARCH_BROWSER_CONFIG = {
  // Default headed: Housing.com (Akamai) returns HTTP 406 "Security Alert" to headless Chromium.
  // Set RESEARCH_BROWSER_HEADLESS=true only behind a provider that passes bot checks.
  headless: process.env.RESEARCH_BROWSER_HEADLESS === 'true',
  defaultTimeoutMs: Number(process.env.RESEARCH_BROWSER_TIMEOUT_MS || 45_000),
  navigationTimeoutMs: Number(process.env.RESEARCH_BROWSER_NAV_TIMEOUT_MS || 60_000),
  maxPoolSize: Number(process.env.RESEARCH_BROWSER_POOL_SIZE || 2),
  maxRetries: Number(process.env.RESEARCH_BROWSER_RETRIES || 2),
  profileRoot:
    process.env.RESEARCH_BROWSER_PROFILE_ROOT
    || path.join(process.cwd(), '.research-profiles'),
  screenshotRoot:
    process.env.RESEARCH_BROWSER_SCREENSHOT_ROOT
    || path.join(process.cwd(), '.research-screenshots'),
  sessionTtlMs: Number(process.env.RESEARCH_SESSION_TTL_MS || 7 * 24 * 60 * 60 * 1000),
} as const;

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

export function getPortalMeta(portal: string) {
  return RESEARCH_PORTALS.find((p) => p.key === portal);
}
