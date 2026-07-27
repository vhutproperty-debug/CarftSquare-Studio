/** One-shot: Housing session + worker validate timing */
import fs from 'fs';
import path from 'path';

function loadEnvLocal() {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
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
process.env.RESEARCH_BROWSER_WORKER_URL =
  process.env.RESEARCH_BROWSER_WORKER_URL ||
  'https://unique-endurance-production-57a8.up.railway.app';

async function main() {
  const {
    requestWorkerValidateSession,
    fetchBrowserWorkerStatus,
    getBrowserWorkerBaseUrl,
  } = await import('../lib/research/browser-gateway/worker-client');
  const { findBrowserSession } = await import('../lib/research/sessions/session-store');

  console.log(JSON.stringify({ base: getBrowserWorkerBaseUrl() }));
  const w = await fetchBrowserWorkerStatus();
  console.log(
    JSON.stringify({
      worker: { online: w.online, healthy: w.healthy, uptime: w.uptime, lastError: w.lastError },
    }),
  );
  const b = await findBrowserSession('workspace-default', 'housing');
  console.log(
    JSON.stringify({
      session: b
        ? {
            id: b.id,
            sessionStatus: b.sessionStatus,
            status: b.status,
            expiresAt: b.expiresAt,
            lastVerified: b.lastVerified,
            hasCookies: Boolean(b.encryptedCookies),
            hasStorage: Boolean(b.encryptedStorage),
            cookieLen: b.encryptedCookies?.length || 0,
            storageLen: b.encryptedStorage?.length || 0,
            lastValidationError: b.lastValidationError || null,
          }
        : null,
    }),
  );

  const t0 = Date.now();
  const r = await requestWorkerValidateSession({
    workspaceId: 'workspace-default',
    portal: 'housing',
  });
  console.log(JSON.stringify({ ms: Date.now() - t0, validate: r }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
