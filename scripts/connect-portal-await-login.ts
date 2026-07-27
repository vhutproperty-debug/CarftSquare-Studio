/**
 * Start Connect for one portal and wait until waiting_for_login (or fail).
 * Does NOT cancel — leaves the session for human OTP.
 *
 *   npx tsx scripts/connect-portal-await-login.ts --portal=magicbricks
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

const portal = process.argv.find((a) => a.startsWith('--portal='))?.slice('--portal='.length);
if (!portal) {
  console.error('Usage: npx tsx scripts/connect-portal-await-login.ts --portal=magicbricks');
  process.exit(2);
}

async function main() {
  process.env.RESEARCH_BROWSER_WORKER_URL =
    process.env.RESEARCH_BROWSER_WORKER_URL ||
    'https://unique-endurance-production-57a8.up.railway.app';

  const { startRemoteConnect, getConnectSessionPublic } = await import(
    '../lib/research/browser-gateway/gateway'
  );
  const { fetchBrowserWorkerStatus } = await import(
    '../lib/research/browser-gateway/worker-client'
  );

  const worker = await fetchBrowserWorkerStatus();
  if (!worker.online) {
    console.error(JSON.stringify({ ok: false, error: 'worker offline' }));
    process.exit(1);
  }

  const { connectSession } = await startRemoteConnect({
    workspaceId: 'workspace-default',
    portal,
    createdBy: 'agent-connect-await-login',
  });

  const deadline = Date.now() + 180_000;
  let lastPhase = '';
  let final = await getConnectSessionPublic(connectSession.id);
  while (Date.now() < deadline) {
    final = await getConnectSessionPublic(connectSession.id);
    if (final?.phase && final.phase !== lastPhase) {
      lastPhase = final.phase;
      console.log(
        JSON.stringify({
          id: final.id,
          portal,
          phase: final.phase,
          message: final.message,
          errorMessage: final.errorMessage || null,
          liveView: Boolean(final.liveViewUrl),
        }),
      );
    }
    const phase = final?.phase || '';
    if (phase === 'waiting_for_login' && final?.liveViewUrl) break;
    if (['failed', 'cancelled', 'expired', 'connected'].includes(phase)) break;
    await new Promise((r) => setTimeout(r, 2500));
  }

  const report = {
    ok:
      final?.phase === 'waiting_for_login' && Boolean(final.liveViewUrl)
        ? true
        : final?.phase === 'connected'
          ? true
          : false,
    portal,
    sessionId: connectSession.id,
    phase: final?.phase || null,
    message: final?.message || null,
    errorMessage: final?.errorMessage || null,
    liveViewUrl: final?.liveViewUrl || null,
    expiresAt: final?.expiresAt || null,
    action:
      final?.phase === 'waiting_for_login'
        ? 'Complete OTP in liveViewUrl before expiresAt — do not cancel'
        : final?.phase === 'failed'
          ? 'Connect failed — see errorMessage'
          : 'Unexpected terminal phase',
  };

  const out = path.join(process.cwd(), 'tmp', 'research-smoke', `connect-${portal}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok || final?.phase === 'failed' ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
