/**
 * Enqueue Connect for portals that need re-auth. Polls until waiting_for_login
 * (or terminal). Human must complete login in the live view.
 *
 *   npx tsx scripts/enqueue-portal-connect.ts magicbricks
 *   npx tsx scripts/enqueue-portal-connect.ts magicbricks 99acres nobroker squareyards
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

async function enqueueOne(portal: string) {
  const { startRemoteConnect, getConnectSessionPublic } = await import(
    '../lib/research/browser-gateway/gateway'
  );
  const { getPortalMeta } = await import('../lib/research/browser/config');
  const meta = getPortalMeta(portal);
  console.log(
    JSON.stringify({
      action: 'enqueue',
      portal,
      loginUrl: meta?.loginUrl,
    }),
  );

  const { connectSession } = await startRemoteConnect({
    workspaceId: 'workspace-default',
    portal,
    createdBy: 'agent-auth-recovery',
  });

  console.log(
    JSON.stringify({
      queued: true,
      id: connectSession.id,
      phase: connectSession.phase,
      portal,
    }),
  );

  const deadline = Date.now() + 120_000;
  let last = '';
  while (Date.now() < deadline) {
    const s = await getConnectSessionPublic(connectSession.id);
    const snap = `${s?.phase}|${s?.message}|${s?.liveViewUrl ? 'live' : 'nolive'}`;
    if (snap !== last) {
      last = snap;
      console.log(
        JSON.stringify({
          id: s?.id,
          portal,
          phase: s?.phase,
          message: s?.message,
          liveViewUrl: s?.liveViewUrl || null,
          errorMessage: s?.errorMessage || null,
        }),
      );
    }
    const phase = s?.phase || '';
    if (['connected', 'failed', 'cancelled', 'expired', 'waiting_for_login'].includes(phase)) {
      if (phase === 'waiting_for_login' && s?.liveViewUrl) break;
      if (['connected', 'failed', 'cancelled', 'expired'].includes(phase)) break;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
}

async function main() {
  const portals = process.argv.slice(2);
  if (!portals.length) {
    console.error('Usage: npx tsx scripts/enqueue-portal-connect.ts <portal> [...]');
    process.exit(1);
  }
  // Sequential — one live browser at a time on the worker.
  for (const portal of portals) {
    await enqueueOne(portal);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
