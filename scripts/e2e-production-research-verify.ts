/**
 * Production-style E2E: Connectors Connected → Research query via worker path.
 *
 *   npx tsx scripts/e2e-production-research-verify.ts
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
// Simulate Vercel Next.js host — must use Browser Worker, never local Playwright.
process.env.VERCEL = '1';

const QUERY = 'Find 2 BHK rentals in Oberoi Sky City';
const WORKSPACE = 'workspace-default';

async function main() {
  const { listConnectorStatuses } = await import('../lib/research/browser-gateway/gateway');
  const {
    fetchBrowserWorkerStatus,
    getBrowserWorkerBaseUrl,
    requestWorkerValidateSession,
    requestWorkerExecuteSearch,
  } = await import('../lib/research/browser-gateway/worker-client');
  const { buildPortalSearchUrl } = await import('../connectors/common/search-url');
  const { isServerlessPlaywrightHost } = await import(
    '../lib/research/browser/playwright-runtime-guard'
  );
  const { executiveResearchAgent } = await import('../lib/research/ai/executive-research-agent');
  const { requirePortalConnector } = await import('../connectors/registry');

  console.log('=== ENV GUARD ===');
  console.log(
    JSON.stringify({
      VERCEL: process.env.VERCEL,
      isServerlessPlaywrightHost: isServerlessPlaywrightHost(),
      workerBase: getBrowserWorkerBaseUrl(),
    }),
  );

  const worker = await fetchBrowserWorkerStatus();
  console.log('=== WORKER STATUS ===');
  console.log(JSON.stringify({ online: worker.online, healthy: worker.healthy, host: worker.workerHost }));
  if (!worker.online || !worker.healthy) throw new Error('Browser Worker offline');

  const statuses = await listConnectorStatuses(WORKSPACE);
  const housing = statuses.connectors.find((c) => c.portal === 'housing');
  console.log('=== CONNECTORS CARD (Housing) ===');
  console.log(
    JSON.stringify({
      displayState: housing?.displayState,
      displayLabel: housing?.displayLabel,
      availableForResearch: housing?.availableForResearch,
      availableLabel: housing?.availableLabel,
      sessionExists: housing?.sessionExists,
      browserSessionId: housing?.browserSessionId,
      lastValidatedAt: housing?.lastValidatedAt,
    }),
  );
  if (housing?.displayState !== 'connected' || !housing.availableForResearch) {
    throw new Error('Housing not Connected/Available for research — Connect first.');
  }

  console.log('=== WORKER VALIDATE (Connectors path) ===');
  const liveValidate = await requestWorkerValidateSession({
    workspaceId: WORKSPACE,
    portal: 'housing',
  });
  console.log(JSON.stringify(liveValidate));
  if (!liveValidate.ok) {
    throw new Error(`Validation failed: ${liveValidate.message}`);
  }

  const criteria = {
    city: 'Mumbai',
    project: 'Oberoi Sky City',
    bhk: 2,
    transactionType: 'RENT' as const,
    portals: ['housing'],
  };
  const searchUrl = buildPortalSearchUrl('housing', criteria);
  console.log('=== SEARCH REQUEST ===');
  console.log(JSON.stringify({ criteria, searchUrl }, null, 2));

  console.log('=== CONNECTOR SEARCH (VERCEL=1 → worker /jobs/search) ===');
  const connector = requirePortalConnector('housing');
  const validation = await connector.validateSession(WORKSPACE);
  console.log('connector.validateSession', JSON.stringify(validation));
  if (!validation.ok) throw new Error(`connector validate failed: ${validation.message}`);

  const search = await connector.executeSearch({
    workspaceId: WORKSPACE,
    criteria,
    sessionId: validation.sessionId,
    skipValidation: true,
  });
  console.log(
    'connector.executeSearch',
    JSON.stringify({
      ok: search.ok,
      sessionStatus: search.sessionStatus,
      message: search.message,
      listingCount: search.listings?.length || 0,
      sample: (search.listings || []).slice(0, 5).map((l) => ({
        title: l.title,
        rent: l.rent,
        projectName: l.projectName,
        url: l.url,
      })),
    }),
  );

  // Page inspect on worker (proves URL / DOM / parser vs empty market)
  console.log('=== WORKER PAGE INSPECT ===');
  const inspectRes = await fetch(`${getBrowserWorkerBaseUrl()}/jobs/inspect-search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(process.env.RESEARCH_BROWSER_WORKER_SECRET
        ? { 'x-research-worker-secret': process.env.RESEARCH_BROWSER_WORKER_SECRET }
        : {}),
    },
    body: JSON.stringify({
      workspaceId: WORKSPACE,
      portal: 'housing',
      url: searchUrl,
    }),
  });
  const inspect = await inspectRes.json().catch(() => ({}));
  console.log('inspect HTTP', inspectRes.status);
  console.log(JSON.stringify(inspect, null, 2));

  console.log('=== RESEARCH AGENT TURN (VERCEL=1) ===');
  const session = await executiveResearchAgent.createSession({
    workspaceId: WORKSPACE,
    createdBy: 'e2e-production-verify',
    title: QUERY.slice(0, 80),
  });
  console.log('aiSessionId', session.id);
  const turn = await executiveResearchAgent.handleMessage({
    sessionId: session.id,
    message: QUERY,
  });
  const final = turn.session;
  console.log(
    JSON.stringify({
      aiSessionId: final.id,
      status: final.status,
      listingCount: final.listings?.length || 0,
      portalsInReport: final.report?.portalsSearched,
      portalErrors: (final.report as { warnings?: string[] } | undefined) || null,
      progressMessage: final.progress?.message,
      assistantPreview: turn.assistantMessage.slice(0, 400),
      topListing: final.listings?.[0]
        ? {
            title: final.listings[0].title,
            rent: final.listings[0].rent,
            projectName: final.listings[0].projectName,
            portal: final.listings[0].portal,
          }
        : null,
    }, null, 2),
  );

  // Diagnose zero listings
  const listingCount = Math.max(search.listings?.length || 0, final.listings?.length || 0);
  console.log('=== ZERO-LISTING DIAGNOSIS ===');
  if (listingCount === 0) {
    const i = inspect as Record<string, unknown>;
    const diagnosis = diagnoseZero({
      searchUrl,
      validationOk: validation.ok,
      searchOk: search.ok,
      sessionStatus: search.sessionStatus,
      inspect: i,
    });
    console.log(JSON.stringify(diagnosis, null, 2));
  } else {
    console.log(JSON.stringify({ verdict: 'listings_returned', listingCount }));
  }

  console.log('=== PASS CRITERIA ===');
  const passAuth =
    validation.ok &&
    search.ok &&
    search.sessionStatus === 'valid' &&
    !/Playwright cannot run|not authenticated/i.test(search.message || '');
  console.log(JSON.stringify({ passAuth, listingCount, aiSessionId: final.id, browserSessionId: validation.sessionId }));
  if (!passAuth) process.exit(1);
  console.log('E2E_AUTH_PATH_OK');
}

function diagnoseZero(input: {
  searchUrl: string;
  validationOk: boolean;
  searchOk: boolean;
  sessionStatus?: string;
  inspect: Record<string, unknown>;
}) {
  if (!input.validationOk) {
    return { rootCause: 'validation_failed', detail: 'Not connected — validate failed' };
  }
  if (!input.searchOk) {
    return { rootCause: 'search_request_failed', detail: input.inspect };
  }
  if (input.inspect?.error || input.inspect?.ok === false) {
    if (/404|Not found/i.test(String(input.inspect?.error || ''))) {
      return {
        rootCause: 'inspect_endpoint_missing',
        detail: 'Worker needs /jobs/inspect-search deployed for DOM proof',
      };
    }
  }
  const httpStatus = Number(input.inspect.httpStatus || 0);
  const propertyAnchors = Number(input.inspect.propertyAnchorCount || 0);
  const totalAnchors = Number(input.inspect.totalAnchorCount || 0);
  const title = String(input.inspect.title || '');
  const security = Boolean(input.inspect.securityChallenge);
  const sampleHrefs = (input.inspect.sampleHrefs as string[]) || [];

  if (security || /security|challenge|access denied|captcha/i.test(title)) {
    return { rootCause: 'page_layout_or_bot_wall', httpStatus, title, sampleHrefs };
  }
  if (httpStatus >= 400) {
    return { rootCause: 'search_url_http_error', httpStatus, searchUrl: input.searchUrl, title };
  }
  if (totalAnchors > 0 && propertyAnchors === 0) {
    return {
      rootCause: 'parser_issue',
      detail:
        'Page has anchors but none match property/rent/buy/flat/apartment/resale href patterns used by collectGenericListings',
      totalAnchors,
      propertyAnchors,
      sampleHrefs,
      searchUrl: input.searchUrl,
    };
  }
  if (totalAnchors === 0) {
    return {
      rootCause: 'page_layout_change_or_empty_shell',
      detail: 'No anchors found — SPA not hydrated, empty results, or blocked shell',
      httpStatus,
      title,
      htmlLength: input.inspect.htmlLength,
      searchUrl: input.searchUrl,
    };
  }
  if (propertyAnchors > 0) {
    return {
      rootCause: 'parser_issue',
      detail: 'Property-like anchors exist but parser returned 0 listings',
      propertyAnchors,
      sampleHrefs,
    };
  }
  return {
    rootCause: 'genuinely_no_matching_listings_or_unknown',
    searchUrl: input.searchUrl,
    inspect: input.inspect,
  };
}

main().catch((err) => {
  console.error('E2E_FAIL', err);
  process.exit(1);
});
