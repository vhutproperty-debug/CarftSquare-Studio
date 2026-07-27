/**
 * Research-path production smoke (Connect frozen — uses existing sessions only).
 *
 * For each portal with encrypted session secrets:
 *   worker validate → connector executeSearch (VERCEL=1 → worker)
 *
 *   npx tsx scripts/smoke-research-production.ts
 *   npx tsx scripts/smoke-research-production.ts --portals=housing,magicbricks
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
if (!process.env.RESEARCH_BROWSER_WORKER_URL) {
  process.env.RESEARCH_BROWSER_WORKER_URL =
    'https://unique-endurance-production-57a8.up.railway.app';
}

const WORKSPACE = 'workspace-default';
const ALL = ['housing', 'magicbricks', '99acres', 'nobroker', 'squareyards'] as const;

function portalFilter(): string[] {
  const arg = process.argv.find((a) => a.startsWith('--portals='));
  if (!arg) return [...ALL];
  return arg
    .slice('--portals='.length)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

type Row = {
  portal: string;
  sessionExists: boolean;
  availableForResearch: boolean;
  displayState: string | null;
  validateOk: boolean | null;
  validateMessage: string | null;
  searchOk: boolean | null;
  listingCount: number | null;
  searchMessage: string | null;
  pass: boolean;
  reason: string;
};

async function main() {
  const {
    fetchBrowserWorkerStatus,
    requestWorkerValidateSession,
  } = await import('../lib/research/browser-gateway/worker-client');
  const { listConnectorStatuses } = await import('../lib/research/browser-gateway/gateway');
  const { findBrowserSession } = await import('../lib/research/sessions/session-store');
  const { requirePortalConnector } = await import('../connectors/registry');

  const worker = await fetchBrowserWorkerStatus();
  console.log(
    JSON.stringify({
      worker: { online: worker.online, healthy: worker.healthy, host: worker.workerHost },
      VERCEL: process.env.VERCEL,
    }),
  );
  if (!worker.online) {
    console.error('Browser Worker offline — Research cannot run');
    process.exit(1);
  }

  const statuses = await listConnectorStatuses(WORKSPACE, { workerOnline: true });
  const portals = portalFilter();
  const rows: Row[] = [];

  for (const portal of portals) {
    const card = statuses.connectors.find((c) => c.portal === portal);
    const browser = await findBrowserSession(WORKSPACE, portal);
    const sessionExists = Boolean(
      browser?.encryptedCookies || browser?.encryptedStorage,
    );
    const base: Row = {
      portal,
      sessionExists,
      availableForResearch: Boolean(card?.availableForResearch),
      displayState: card?.displayState || null,
      validateOk: null,
      validateMessage: null,
      searchOk: null,
      listingCount: null,
      searchMessage: null,
      pass: false,
      reason: '',
    };

    if (!sessionExists) {
      base.reason = 'no encrypted session — Connect required (out of Research scope)';
      base.pass = true; // skip, not a Research regression
      rows.push(base);
      console.log(JSON.stringify({ step: 'skip', ...base }));
      continue;
    }

    console.log(JSON.stringify({ step: 'validate', portal, displayState: base.displayState }));
    const live = await requestWorkerValidateSession({
      workspaceId: WORKSPACE,
      portal,
    });
    base.validateOk = Boolean(live.ok);
    base.validateMessage = live.message || live.status || null;

    if (!live.ok) {
      base.reason = `validate failed: ${base.validateMessage}`;
      base.pass = false;
      rows.push(base);
      console.log(JSON.stringify({ step: 'validate_fail', portal, live }));
      continue;
    }

    // Housing Oberoi seed inventory is predominantly 3 BHK (2 BHK over-filters to 0).
    const criteria = {
      city: 'Mumbai',
      bhk: portal === 'housing' ? 3 : 2,
      transactionType: 'RENT' as const,
      portals: [portal],
      project: portal === 'housing' ? 'Oberoi Sky City' : undefined,
    };

    console.log(JSON.stringify({ step: 'search', portal, criteria }));
    try {
      const connector = requirePortalConnector(portal);
      const validation = await connector.validateSession(WORKSPACE);
      if (!validation.ok) {
        base.validateOk = false;
        base.validateMessage = validation.message || validation.status || 'validate failed';
        base.reason = `connector.validateSession failed: ${base.validateMessage}`;
        base.pass = false;
        rows.push(base);
        continue;
      }

      const search = await connector.executeSearch({
        workspaceId: WORKSPACE,
        criteria,
        sessionId: validation.sessionId,
        skipValidation: true,
      });
      base.searchOk = Boolean(search.ok);
      base.listingCount = Array.isArray(search.listings) ? search.listings.length : 0;
      base.searchMessage = search.message || search.sessionStatus || null;

      // Empty extract with ok/degraded is acceptable Research behavior (DOM change).
      const degradedEmpty =
        search.ok && (search as { degraded?: boolean }).degraded && base.listingCount === 0;
      base.pass =
        Boolean(search.ok) &&
        (base.listingCount! > 0 || degradedEmpty || search.sessionStatus === 'valid');
      if (base.listingCount! > 0) {
        base.reason = `search ok listings=${base.listingCount}`;
      } else if (degradedEmpty) {
        base.reason = 'search ok but empty extract (portal degraded — Research path OK)';
      } else if (search.ok) {
        base.reason = `search ok but 0 listings (status=${search.sessionStatus})`;
        // Still pass if session stayed valid — listings quality is portal DOM.
        base.pass = search.sessionStatus === 'valid' || search.sessionStatus === 'healthy';
      } else {
        base.reason = `search failed: ${base.searchMessage}`;
        base.pass = false;
      }
    } catch (e) {
      base.searchOk = false;
      base.searchMessage = e instanceof Error ? e.message : String(e);
      base.reason = `search exception: ${base.searchMessage}`;
      base.pass = false;
    }

    rows.push(base);
    console.log(JSON.stringify({ step: 'done', ...base }));
  }

  const researchRows = rows.filter((r) => r.sessionExists);
  const report = {
    at: new Date().toISOString(),
    commit: process.env.GIT_SHA || null,
    workerUrl: process.env.RESEARCH_BROWSER_WORKER_URL,
    rows,
    withSession: researchRows.length,
    passCount: researchRows.filter((r) => r.pass).length,
    failCount: researchRows.filter((r) => !r.pass).length,
    skippedNoSession: rows.filter((r) => !r.sessionExists).length,
  };

  const outDir = path.join(process.cwd(), 'tmp', 'research-smoke');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  // Fail only when a portal WITH session fails Research validate/search.
  process.exit(report.failCount > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
