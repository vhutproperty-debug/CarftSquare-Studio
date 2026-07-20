/**
 * E2E: Connectors-connected Housing session → Research serverless path → listings.
 * Simulates Vercel (VERCEL=1) so BasePortalConnector uses worker /jobs/*.
 *
 *   npx tsx scripts/e2e-housing-research-via-worker.ts
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
process.env.VERCEL = '1'; // force serverless connector path

async function main() {
  const workspaceId = 'workspace-default';
  const { requirePortalConnector } = await import('../connectors/registry');
  const { listConnectorStatuses } = await import('../lib/research/browser-gateway/gateway');
  const { fetchBrowserWorkerStatus } = await import(
    '../lib/research/browser-gateway/worker-client'
  );

  const worker = await fetchBrowserWorkerStatus();
  console.log('worker', { online: worker.online, healthy: worker.healthy, host: worker.workerHost });
  if (!worker.online) throw new Error('Worker offline');

  const statuses = await listConnectorStatuses(workspaceId);
  const housing = statuses.connectors.find((c) => c.portal === 'housing');
  console.log('connectorsCard', {
    displayState: housing?.displayState,
    availableForResearch: housing?.availableForResearch,
    sessionExists: housing?.sessionExists,
  });
  if (housing?.displayState !== 'connected' || !housing.availableForResearch) {
    throw new Error('Housing is not Connected/Available — Connect first.');
  }

  const connector = requirePortalConnector('housing');
  console.log('validate (serverless→worker)…');
  const validation = await connector.validateSession(workspaceId);
  console.log('validation', {
    ok: validation.ok,
    status: validation.status,
    sessionId: validation.sessionId,
    message: validation.message,
  });
  if (!validation.ok) throw new Error(`Validate failed: ${validation.message}`);

  console.log('search (serverless→worker)…');
  const search = await connector.executeSearch({
    workspaceId,
    criteria: {
      city: 'Mumbai',
      bhk: 2,
      transactionType: 'RENT',
      portals: ['housing'],
    },
    sessionId: validation.sessionId,
    skipValidation: true,
  });
  console.log('search', {
    ok: search.ok,
    sessionStatus: search.sessionStatus,
    message: search.message,
    listings: search.listings?.length || 0,
    sample: (search.listings || []).slice(0, 5).map((l) => ({
      title: l.title,
      rent: l.rent,
      projectName: l.projectName,
      portal: l.portal,
      url: l.url?.slice(0, 100),
    })),
  });
  if (!search.ok) throw new Error(`Search failed: ${search.message}`);
  // Authenticated path success: worker accepted the shared session (not Playwright-on-Vercel failure).
  // Zero listings can still happen on portal DOM variance; treat auth as proven when ok+valid.
  if (search.sessionStatus !== 'valid' && search.sessionStatus !== 'active') {
    throw new Error(`Unexpected sessionStatus after search: ${search.sessionStatus}`);
  }
  if (/Playwright cannot run|not authenticated|Login required|needs_login/i.test(search.message || '')) {
    throw new Error(`Auth path failed: ${search.message}`);
  }
  console.log(
    search.listings?.length
      ? 'E2E_OK_WITH_LISTINGS'
      : 'E2E_OK_AUTHENTICATED_ZERO_LISTINGS',
  );
}

main().catch((err) => {
  console.error('E2E_FAIL', err);
  process.exit(1);
});
