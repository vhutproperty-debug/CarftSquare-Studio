/**
 * Evidence dump: Housing portal connection + browser session vs worker validate.
 *   npx tsx scripts/diagnose-connector-vs-research.ts
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

async function main() {
  const { findPortalConnection } = await import('../lib/research/store/portal-connections');
  const { findBrowserSession } = await import('../lib/research/sessions/session-store');
  const { listConnectorStatuses } = await import('../lib/research/browser-gateway/gateway');
  const { requestWorkerValidateSession, fetchBrowserWorkerStatus } = await import(
    '../lib/research/browser-gateway/worker-client'
  );
  const { isServerlessPlaywrightHost } = await import(
    '../lib/research/browser/playwright-runtime-guard'
  );

  const workspaceId = 'workspace-default';
  const portal = 'housing';

  const connection = await findPortalConnection(workspaceId, portal);
  const browser = await findBrowserSession(workspaceId, portal);
  const statuses = await listConnectorStatuses(workspaceId);
  const housingCard = statuses.connectors.find((c) => c.portal === portal);
  const worker = await fetchBrowserWorkerStatus();

  console.log(
    JSON.stringify(
      {
        isServerlessPlaywrightHost: isServerlessPlaywrightHost(),
        VERCEL: process.env.VERCEL || null,
        portalConnection: connection
          ? {
              status: connection.status,
              lastError: connection.lastError || null,
              updatedAt: connection.updatedAt,
            }
          : null,
        browserSession: browser
          ? {
              id: browser.id,
              sessionStatus: browser.sessionStatus,
              hasEncryptedCookies: Boolean(browser.encryptedCookies),
              lastVerified: browser.lastVerified || null,
              expiresAt: browser.expiresAt || null,
              lastValidationError: browser.lastValidationError || null,
            }
          : null,
        connectorsPageCard: housingCard
          ? {
              displayState: housingCard.displayState,
              displayLabel: housingCard.displayLabel,
              availableForResearch: housingCard.availableForResearch,
              sessionExists: housingCard.sessionExists,
              lastValidatedAt: housingCard.lastValidatedAt,
              humanError: housingCard.humanError,
            }
          : null,
        worker: {
          online: worker.online,
          healthy: worker.healthy,
          workerHost: worker.workerHost,
        },
      },
      null,
      2,
    ),
  );

  console.log('--- worker live validate (same path Connectors Refresh uses) ---');
  const live = await requestWorkerValidateSession({ workspaceId, portal });
  console.log(JSON.stringify(live, null, 2));

  console.log('--- Research path note ---');
  console.log(
    'Research calls BasePortalConnector.validateSession → browserSessionManager.validateSession(force) → BrowserFactory.launchPersistent → assertPlaywrightRuntimeAllowed',
  );
  console.log(
    'On Vercel that throws: Playwright cannot run on this host. Connectors never take that path; they use /jobs/validate on the worker.',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
