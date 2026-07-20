/**
 * One-off diagnostic: recent connect sessions + optional Housing enqueue.
 *   npx tsx scripts/diagnose-connect-flow.ts
 *   npx tsx scripts/diagnose-connect-flow.ts --enqueue
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

function hostOf(url?: string | null) {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return String(url).slice(0, 80);
  }
}

async function main() {
  const { getResearchDatabase, ensureResearchIndexes } = await import(
    '../lib/research/store'
  );
  const { RESEARCH_COLLECTIONS } = await import('../lib/research/collections');
  const { getWorkerPublicBaseUrl } = await import(
    '../lib/research/browser-gateway/remote-display/signed-url'
  );
  const { fetchBrowserWorkerStatus } = await import(
    '../lib/research/browser-gateway/worker-client'
  );

  console.log('--- env (this process) ---');
  console.log(
    'RESEARCH_BROWSER_WORKER_URL=',
    process.env.RESEARCH_BROWSER_WORKER_URL || '(unset)',
  );
  console.log(
    'RESEARCH_BROWSER_WORKER_PUBLIC_URL=',
    process.env.RESEARCH_BROWSER_WORKER_PUBLIC_URL || '(unset)',
  );
  console.log(
    'getWorkerPublicBaseUrl()=',
    getWorkerPublicBaseUrl(),
  );
  console.log('AUTH_SECRET set=', Boolean(process.env.AUTH_SECRET));

  const worker = await fetchBrowserWorkerStatus();
  console.log('--- worker /status via WORKER_URL ---');
  console.log(
    JSON.stringify(
      {
        online: worker.online,
        healthy: worker.healthy,
        workerHost: worker.workerHost,
        source: worker.source,
        lastError: worker.lastError,
        queueSize: worker.queueSize,
        activeSessions: worker.activeSessions,
      },
      null,
      2,
    ),
  );

  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  const rows = await db
    .collection(RESEARCH_COLLECTIONS.connectSessions)
    .find({})
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();

  console.log('--- recent connectSessions ---');
  for (const s of rows) {
    const url = (s.liveViewUrl as string | undefined) || null;
    console.log(
      JSON.stringify({
        id: s.id,
        portal: s.portal,
        phase: s.phase,
        createdAt: s.createdAt,
        message: s.message,
        errorMessage: s.errorMessage || null,
        liveViewHost: hostOf(url),
        isLocalhost: url ? /127\.0\.0\.1|localhost/i.test(url) : null,
      }),
    );
  }

  if (!process.argv.includes('--enqueue')) {
    console.log('Pass --enqueue to start a live Housing connect test.');
    return;
  }

  console.log('--- enqueue Housing connect ---');
  const { startRemoteConnect, getConnectSessionPublic } = await import(
    '../lib/research/browser-gateway/gateway'
  );
  const { connectSession } = await startRemoteConnect({
    workspaceId: 'workspace-default',
    portal: 'housing',
    createdBy: 'agent-connect-diagnose',
  });
  console.log(JSON.stringify({ queued: true, id: connectSession.id }));

  const deadline = Date.now() + 120_000;
  let last = '';
  while (Date.now() < deadline) {
    const s = await getConnectSessionPublic(connectSession.id);
    const snap = `${s?.phase}|${s?.liveViewUrl ? 'live' : 'nolive'}|${s?.message || ''}`;
    if (snap !== last) {
      last = snap;
      console.log(
        JSON.stringify({
          id: s?.id,
          phase: s?.phase,
          message: s?.message,
          liveViewHost: hostOf(s?.liveViewUrl),
          isLocalhost: s?.liveViewUrl
            ? /127\.0\.0\.1|localhost/i.test(s.liveViewUrl)
            : null,
          liveViewUrlPrefix: s?.liveViewUrl
            ? s.liveViewUrl.slice(0, 120) + '…'
            : null,
          errorMessage: s?.errorMessage || null,
        }),
      );
    }
    if (
      s?.phase === 'waiting_for_login' &&
      s.liveViewUrl &&
      !/127\.0\.0\.1|localhost/i.test(s.liveViewUrl)
    ) {
      // Probe live view HTML briefly
      try {
        const res = await fetch(s.liveViewUrl, { redirect: 'manual' });
        console.log(
          JSON.stringify({
            liveViewProbe: true,
            http: res.status,
            contentType: res.headers.get('content-type'),
          }),
        );
      } catch (err) {
        console.log(
          JSON.stringify({
            liveViewProbe: false,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
      break;
    }
    if (['failed', 'cancelled', 'expired', 'connected'].includes(s?.phase || '')) {
      break;
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
