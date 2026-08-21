/**
 * Live production smoke: Connector API search must return genuine listing URLs only.
 *
 * Env:
 *   CRAFTSQUARE_RESEARCH_BASE_URL (default https://craftsquare.co.in)
 *   CRAFTSQUARE_PROP_AI_API_KEY or PROP_AI_API_KEY
 *
 * Run: npm run test:listing-urls:prod
 */

import { isGenuineListingUrl } from '../connectors/common/listing-url';

const BASE = String(process.env.CRAFTSQUARE_RESEARCH_BASE_URL || 'https://craftsquare.co.in').replace(
  /\/$/,
  '',
);
const KEY = String(
  process.env.CRAFTSQUARE_PROP_AI_API_KEY || process.env.PROP_AI_API_KEY || '',
).trim();

const PROVIDERS = (process.env.LISTING_URL_SMOKE_PROVIDERS || 'nobroker,squareyards,housing')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

async function main() {
  if (!KEY) {
    console.error('Set CRAFTSQUARE_PROP_AI_API_KEY or PROP_AI_API_KEY');
    process.exit(1);
  }

  const body = {
    providers: PROVIDERS,
    criteria: {
      city: 'Mumbai',
      locality: 'Andheri West',
      bhk: 2,
      transactionType: 'rent',
      maxBudget: 50000,
    },
  };

  console.log(`POST ${BASE}/api/connectors/v1/search`);
  console.log(`providers=${PROVIDERS.join(',')}`);

  const res = await fetch(`${BASE}/api/connectors/v1/search`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    results?: Array<{
      provider: string;
      ok: boolean;
      listings?: Array<{ url?: string; title?: string }>;
      sessionStatus?: string;
      message?: string;
    }>;
    listings?: Array<{ portal?: string; url?: string }>;
  };

  if (!res.ok) {
    console.error('Search failed', res.status, data.error || data);
    process.exit(1);
  }

  const results = Array.isArray(data.results) ? data.results : [];
  let hardFail = 0;
  let sessionBlocked = 0;

  for (const provider of PROVIDERS) {
    const row = results.find((r) => r.provider === provider);
    const listings = row?.listings || [];
    const bad = listings.filter((l) => !isGenuineListingUrl(provider, l.url || ''));
    const good = listings.filter((l) => isGenuineListingUrl(provider, l.url || ''));
    const sessionBlockedMsg =
      /needs_login|TTL expired|Login required|session/i.test(String(row?.message || '')) ||
      row?.sessionStatus === 'needs_login' ||
      row?.sessionStatus === 'expired';

    console.log(
      `\n[${provider}] ok=${row?.ok} session=${row?.sessionStatus} total=${listings.length} genuine=${good.length} invalid=${bad.length}`,
    );
    if (row?.message) console.log(`  message: ${row.message}`);
    for (const l of good.slice(0, 3)) console.log(`  OK  ${l.url}`);
    for (const l of bad.slice(0, 5)) console.log(`  BAD ${l.url}`);

    if (bad.length) {
      console.error(`FAIL ${provider}: returned nav/marketing URLs`);
      hardFail += 1;
      continue;
    }
    if (good.length >= 1) continue;
    if (sessionBlockedMsg) {
      console.warn(`SKIP ${provider}: portal session not Research Ready (reconnect in CraftSquare UI)`);
      sessionBlocked += 1;
      continue;
    }
    // Zero listings with zero invalid URLs means the filter is correct but the
    // portal SERP/API returned nothing usable (often DC IP / missing geo token).
    console.warn(
      `WARN ${provider}: 0 genuine listings (no nav URLs leaked). Check portal SERP/API/proxy.`,
    );
  }

  if (hardFail) {
    console.error(`\nSmoke failed (${hardFail} provider check(s)).`);
    process.exit(1);
  }
  if (sessionBlocked && sessionBlocked === PROVIDERS.length) {
    console.warn(
      `\nNo provider returned listings — all sessions blocked. Filter deploy is OK; reconnect portals then re-run.`,
    );
    process.exit(2);
  }
  console.log('\nProduction listing-url smoke passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
