/**
 * Full multi-portal connector diagnostic (read-only evidence collection).
 * Does not mutate architecture. Writes JSON report to tmp/.
 *
 *   npx tsx scripts/diagnose-all-connectors.ts
 */
import fs from 'fs';
import path from 'path';
import { buildPortalSearchUrl } from '../connectors/common/search-url';

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

const PORTALS = ['housing', 'magicbricks', '99acres', 'nobroker', 'squareyards'] as const;
const WORKSPACE = 'workspace-default';

type FailureCategory =
  | 'Browser failure'
  | 'Session expired'
  | 'Authentication failed'
  | 'Captcha'
  | 'Akamai blocked'
  | 'Cloudflare blocked'
  | 'Network timeout'
  | 'DOM changed'
  | 'Parser failure'
  | 'Inventory extraction failure'
  | 'Unknown'
  | null;

function categorize(input: {
  validateMessage?: string;
  validateStatus?: string;
  httpStatus?: number | null;
  title?: string;
  body?: string;
  securityChallenge?: boolean;
  listingCount?: number;
  error?: string;
}): { category: FailureCategory; evidence: string; recovery: string } {
  const blob = [
    input.validateMessage,
    input.validateStatus,
    input.title,
    input.body,
    input.error,
    input.httpStatus != null ? `HTTP ${input.httpStatus}` : '',
  ]
    .filter(Boolean)
    .join(' | ')
    .toLowerCase();

  if (/timeout|timed out|abort/i.test(blob)) {
    return {
      category: 'Network timeout',
      evidence: blob.slice(0, 300),
      recovery: 'Retry with backoff; check worker/network; raise navigation timeout if persistent.',
    };
  }
  if (/page crashed|target closed|browser.*(crash|closed|disconnected)|execution context/i.test(blob)) {
    return {
      category: 'Browser failure',
      evidence: blob.slice(0, 300),
      recovery: 'Invalidate warm page, restart context, retry same request (already wired for search/validate crash).',
    };
  }
  if (/access denied|reference\s*#|akamai|security alert|bot.?manager|edgesuite|ghost\s*ip/i.test(blob)) {
    return {
      category: 'Akamai blocked',
      evidence: blob.slice(0, 300),
      recovery:
        'Do not retry aggressively. Reconnect from residential/non-datacenter path or headed browser with fresh profile; avoid automation fingerprints.',
    };
  }
  if (/cloudflare|cf-ray|attention required|just a moment/i.test(blob)) {
    return {
      category: 'Cloudflare blocked',
      evidence: blob.slice(0, 300),
      recovery: 'Wait for challenge completion in headed connect session; avoid headless; refresh session after human solve.',
    };
  }
  if (/captcha|recaptcha|hcaptcha|challenge/i.test(blob) && input.securityChallenge) {
    return {
      category: 'Captcha',
      evidence: blob.slice(0, 300),
      recovery: 'Complete challenge in connect live view; capture new cookies; re-validate.',
    };
  }
  if (
    input.validateStatus === 'needs_login' ||
    /login required|login expired|needs.?login|unauthorized|401|403/i.test(blob)
  ) {
    return {
      category: input.validateStatus === 'needs_login' || /login|expired/i.test(blob)
        ? 'Session expired'
        : 'Authentication failed',
      evidence: blob.slice(0, 300),
      recovery: 'Reconnect portal, complete login, wait until Research Ready, then retry.',
    };
  }
  if (input.httpStatus === 404 || /page not found/i.test(blob)) {
    return {
      category: 'DOM changed',
      evidence: blob.slice(0, 300),
      recovery: 'Fix portal search URL builder; verify current SERP shape on portal.',
    };
  }
  if (
    input.listingCount === 0 &&
    input.httpStatus === 200 &&
    !input.securityChallenge &&
    /property|rent|buy/i.test(input.title || '')
  ) {
    return {
      category: 'Inventory extraction failure',
      evidence: `HTTP 200 but listingCount=0; title=${input.title}`,
      recovery: 'Improve portal-specific selectors; generic anchor harvest insufficient for this SERP DOM.',
    };
  }
  if (input.listingCount === 0 && input.httpStatus === 200) {
    return {
      category: 'Parser failure',
      evidence: blob.slice(0, 300),
      recovery: 'Inspect DOM; update collectGenericListings / portal parser.',
    };
  }
  if (!input.validateStatus && !input.httpStatus && input.error) {
    return {
      category: 'Unknown',
      evidence: blob.slice(0, 300),
      recovery: 'Capture worker logs + inspect-search HTML for this portal.',
    };
  }
  return { category: null, evidence: '', recovery: '' };
}

async function inspectSearch(input: {
  base: string;
  secret?: string;
  workspaceId: string;
  portal: string;
  url: string;
}) {
  const res = await fetch(`${input.base}/jobs/inspect-search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(input.secret ? { 'x-research-worker-secret': input.secret } : {}),
    },
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      portal: input.portal,
      url: input.url,
    }),
  });
  const json = await res.json().catch(() => ({}));
  return { http: res.status, body: json as Record<string, unknown> };
}

async function main() {
  const { findPortalConnection } = await import('../lib/research/store/portal-connections');
  const { findBrowserSession } = await import('../lib/research/sessions/session-store');
  const { listConnectorStatuses } = await import('../lib/research/browser-gateway/gateway');
  const {
    requestWorkerValidateSession,
    requestWorkerExecuteSearch,
    fetchBrowserWorkerStatus,
    fetchBrowserWorkerLogs,
    getBrowserWorkerBaseUrl,
  } = await import('../lib/research/browser-gateway/worker-client');
  const { RESEARCH_PORTALS } = await import('../lib/research/browser/config');

  const criteria = {
    city: 'Mumbai',
    project: 'Oberoi Sky City',
    bhk: 2,
    transactionType: 'RENT' as const,
    portals: [...PORTALS],
  };

  const worker = await fetchBrowserWorkerStatus();
  const logs = await fetchBrowserWorkerLogs(120);
  const statuses = await listConnectorStatuses(WORKSPACE);
  const base = getBrowserWorkerBaseUrl();
  const secret = process.env.RESEARCH_BROWSER_WORKER_SECRET;

  const portalReports: Record<string, unknown>[] = [];

  for (const portal of PORTALS) {
    const meta = RESEARCH_PORTALS.find((p) => p.key === portal);
    const connection = await findPortalConnection(WORKSPACE, portal);
    const browser = await findBrowserSession(WORKSPACE, portal);
    const card = statuses.connectors.find((c) => c.portal === portal);
    const searchUrl = buildPortalSearchUrl(portal, criteria);

    const validate = await requestWorkerValidateSession({
      workspaceId: WORKSPACE,
      portal,
    });

    let inspect: { http: number; body: Record<string, unknown> } | null = null;
    let search: Awaited<ReturnType<typeof requestWorkerExecuteSearch>> | null = null;

    if (browser?.encryptedCookies) {
      inspect = await inspectSearch({
        base,
        secret,
        workspaceId: WORKSPACE,
        portal,
        url: searchUrl,
      });
      // Only run full search when validate ok — still record inspect always.
      if (validate.ok) {
        search = await requestWorkerExecuteSearch({
          workspaceId: WORKSPACE,
          portal,
          criteria: { ...criteria, portals: [portal] },
          sessionId: validate.sessionId,
          skipValidation: true,
        });
      }
    }

    const title = String(inspect?.body?.title || '');
    const bodySample = String(inspect?.body?.bodyTextSample || '');
    const httpStatus =
      typeof inspect?.body?.httpStatus === 'number' ? inspect.body.httpStatus : null;
    const listingCount = search?.listings?.length ?? null;
    const fail = categorize({
      validateMessage: validate.message,
      validateStatus: validate.status,
      httpStatus,
      title,
      body: bodySample,
      securityChallenge: Boolean(inspect?.body?.securityChallenge),
      listingCount: listingCount ?? undefined,
      error: typeof inspect?.body?.error === 'string' ? inspect.body.error : search?.message,
    });

    const accessDenied = /access denied|reference\s*#/i.test(`${title} ${bodySample}`);
    const akamaiHints = {
      accessDenied,
      referenceMatch: (bodySample.match(/reference\s*#[a-z0-9.]+/i) || [])[0] || null,
      securityChallenge: Boolean(inspect?.body?.securityChallenge),
      title,
      bodySnippet: bodySample.slice(0, 280),
    };

    portalReports.push({
      portal,
      displayName: meta?.displayName,
      origin: meta?.origin,
      loginUrl: meta?.loginUrl,
      searchUrl,
      stored: {
        connectionStatus: connection?.status || null,
        connectionLastError: connection?.lastError || null,
        sessionStatus: browser?.sessionStatus || null,
        hasEncryptedCookies: Boolean(browser?.encryptedCookies),
        hasEncryptedStorage: Boolean(browser?.encryptedStorage),
        lastVerified: browser?.lastVerified || null,
        expiresAt: browser?.expiresAt || null,
        lastValidationError: browser?.lastValidationError || null,
        sessionId: browser?.id || null,
      },
      statusCard: card
        ? {
            displayState: card.displayState,
            health: card.health,
            availableForResearch: card.availableForResearch,
            humanError: card.humanError,
            diagnostics: card.diagnostics
              ? {
                  researchReady: card.diagnostics.researchReady,
                  validationResult: card.diagnostics.validationResult,
                  failureReason: card.diagnostics.failureReason,
                  suggestedAction: card.diagnostics.suggestedAction,
                  checks: card.diagnostics.checks,
                }
              : null,
          }
        : null,
      validate,
      inspect,
      search: search
        ? {
            ok: search.ok,
            listingCount: search.listings?.length || 0,
            sessionStatus: search.sessionStatus,
            message: search.message,
            sampleTitles: (search.listings || []).slice(0, 5).map((l) => l.title),
          }
        : null,
      failure: fail.category
        ? {
            category: fail.category,
            failingStep: !browser?.encryptedCookies
              ? 'session_missing'
              : !validate.ok
                ? 'validateSession'
                : listingCount === 0
                  ? 'executeSearch_or_extract'
                  : 'none',
            evidence: fail.evidence,
            suggestedRecovery: fail.recovery,
          }
        : null,
      magicbricksProbe: portal === 'magicbricks' ? akamaiHints : undefined,
      dimensions: {
        browser: worker.online ? (fail.category === 'Browser failure' ? 'FAIL' : 'OK_shared_pool') : 'FAIL',
        network:
          httpStatus == null && !inspect?.body?.error
            ? browser?.encryptedCookies
              ? 'SKIPPED'
              : 'N/A_no_session'
            : fail.category === 'Network timeout' ||
                fail.category === 'Akamai blocked' ||
                fail.category === 'Cloudflare blocked'
              ? 'FAIL'
              : 'OK_or_portal_response',
        authentication: validate.ok
          ? 'HEALTHY'
          : validate.status === 'needs_login'
            ? 'SESSION_EXPIRED'
            : 'FAILED',
        session: browser?.encryptedCookies
          ? browser.sessionStatus === 'valid' || validate.ok
            ? 'PRESENT'
            : 'PRESENT_INVALID'
          : 'MISSING',
        search:
          listingCount == null
            ? validate.ok
              ? 'NOT_RUN'
              : 'BLOCKED_BY_AUTH'
            : listingCount > 0
              ? 'HEALTHY'
              : 'FAILED',
        extraction:
          listingCount == null
            ? 'NOT_RUN'
            : listingCount > 0
              ? 'HEALTHY_generic_or_housing'
              : 'FAILED',
        inventory:
          listingCount == null ? 'UNKNOWN' : listingCount > 0 ? `OK_${listingCount}` : 'EMPTY',
      },
    });
  }

  const relevantLogs = logs.filter((l) =>
    /magicbricks|access denied|akamai|security|99acres|nobroker|squareyards|housing|page crashed|validate|search/i.test(
      l.message,
    ),
  );

  const report = {
    checkedAt: new Date().toISOString(),
    worker: {
      online: worker.online,
      healthy: worker.healthy,
      workerHost: worker.workerHost,
      lastError: worker.lastError,
      provider: worker.provider,
    },
    architectureNotes: {
      sharedBase: 'All portals extend BasePortalConnector; only Housing has portal-specific SERP/extract.',
      browserLifecycle:
        'BrowserFactory.launchPersistent + BrowserPool warm page per workspace::portal; SessionLoader cookies+storage.',
      ocrFallback: 'NOT IMPLEMENTED — connectors/extraction-engine.ts is interface stub only; no OCR in tree.',
      pagination: 'NOT IMPLEMENTED — single results page harvest only.',
      failover: 'searchPortalsInParallel continues on per-portal failure.',
      resourceBlocking:
        'Automation contexts abort image/font/media + trackers — can break bot-managed SPAs.',
      headlessDefault: 'RESEARCH_BROWSER_HEADLESS !== true → headed (Akamai note for Housing).',
    },
    portals: portalReports,
    relevantWorkerLogs: relevantLogs.slice(-40),
  };

  const outPath = path.join(process.cwd(), 'tmp', 'connector-full-diagnostic.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.error(`\nWrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
