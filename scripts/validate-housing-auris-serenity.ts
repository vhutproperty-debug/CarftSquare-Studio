/**
 * Validate Housing search quality for: Find 2 BHK rentals in Auris Serenity
 *
 *   npx tsx scripts/validate-housing-auris-serenity.ts
 */
import fs from 'fs';
import path from 'path';

function loadEnvLocal() {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch {
    /* optional */
  }
}

loadEnvLocal();
process.env.VERCEL = '1';

async function main() {
  const { isServerlessPlaywrightHost } = await import(
    '../lib/research/browser/playwright-runtime-guard'
  );
  const { requirePortalConnector } = await import('../connectors/registry');
  const { buildHousingSearchEntryUrl, HOUSING_LISTING_URL_RE } = await import(
    '../connectors/housing/housing-listings'
  );

  const criteria = {
    city: 'Mumbai',
    project: 'Auris Serenity',
    bhk: 2,
    transactionType: 'RENT' as const,
    portals: ['housing'],
  };

  console.log('=== GUARD ===');
  console.log(
    JSON.stringify({
      VERCEL: process.env.VERCEL,
      isServerlessPlaywrightHost: isServerlessPlaywrightHost(),
      entryUrl: buildHousingSearchEntryUrl(criteria),
    }),
  );

  const connector = requirePortalConnector('housing');
  const validation = await connector.validateSession('workspace-default');
  console.log('=== VALIDATE ===');
  console.log(JSON.stringify(validation));
  if (!validation.ok) throw new Error('Housing validation failed');

  const search = await connector.executeSearch({
    workspaceId: 'workspace-default',
    criteria,
    sessionId: validation.sessionId,
    skipValidation: true,
  });

  const listings = search.listings || [];
  const genuine = listings.filter((l) => l.url && HOUSING_LISTING_URL_RE.test(l.url));
  const complete = genuine.filter(
    (l) =>
      l.title &&
      l.projectName &&
      l.rent != null &&
      l.configuration &&
      l.areaSqft != null &&
      l.url,
  );

  console.log('=== RESULT ===');
  console.log(
    JSON.stringify(
      {
        ok: search.ok,
        sessionStatus: search.sessionStatus,
        message: search.message,
        rawListingCount: listings.length,
        validListingCount: complete.length,
        filteredOutCount: Math.max(0, listings.length - complete.length),
        sampleListingUrls: complete.slice(0, 8).map((l) => l.url),
        sample: complete.slice(0, 5).map((l) => ({
          title: l.title,
          project: l.projectName,
          rent: l.rent,
          configuration: l.configuration,
          areaSqft: l.areaSqft,
          url: l.url,
        })),
      },
      null,
      2,
    ),
  );

  if (!search.ok || search.sessionStatus !== 'valid') {
    throw new Error('Search auth path failed');
  }
  if (complete.length === 0) {
    throw new Error('No genuine complete Housing rental listings returned');
  }
  console.log('HOUSING_QUALITY_OK', complete.length);
}

main().catch((err) => {
  console.error('HOUSING_QUALITY_FAIL', err);
  process.exit(1);
});
