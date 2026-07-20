/**
 * Enqueue Housing Connect against the live Browser Worker and poll until
 * Waiting for Login (or later). Loads `.env.local` for Mongo + worker URL.
 *
 *   npx tsx scripts/enqueue-housing-connect.ts
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
  const { startRemoteConnect, getConnectSessionPublic } = await import(
    '../lib/research/browser-gateway/gateway'
  );

  const { connectSession } = await startRemoteConnect({
    workspaceId: 'workspace-default',
    portal: 'housing',
    createdBy: 'agent-login-fix-test',
  });

  console.log(
    JSON.stringify(
      { queued: true, id: connectSession.id, phase: connectSession.phase },
      null,
      2,
    ),
  );

  const deadline = Date.now() + 180_000;
  let last = '';
  while (Date.now() < deadline) {
    const s = await getConnectSessionPublic(connectSession.id);
    const snap = `${s?.phase}|${s?.message}|${s?.liveViewUrl ? 'live' : 'nolive'}`;
    if (snap !== last) {
      last = snap;
      console.log(
        JSON.stringify({
          id: s?.id,
          phase: s?.phase,
          message: s?.message,
          liveViewUrl: s?.liveViewUrl || null,
          errorMessage: s?.errorMessage || null,
        }),
      );
    }
    const phase = s?.phase || '';
    if (
      ['connected', 'failed', 'cancelled', 'expired'].includes(phase)
    ) {
      break;
    }
    // Keep polling through capturing/encrypting/validating after login wait.
    if (phase === 'waiting_for_login') {
      // Auth may auto-detect; do not exit early.
    }
    await new Promise((r) => setTimeout(r, 3000));
  }

  const final = await getConnectSessionPublic(connectSession.id);
  console.log('FINAL', JSON.stringify(final, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
