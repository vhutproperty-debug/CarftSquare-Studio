/**
 * Cancel active Connect sessions (optionally for one portal).
 * Does NOT disconnect or wipe encrypted Research sessions.
 *
 *   npx tsx scripts/cancel-active-connects.ts
 *   npx tsx scripts/cancel-active-connects.ts --portal=housing
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

async function main() {
  const portalArg = process.argv.find((a) => a.startsWith('--portal='))?.slice('--portal='.length);
  const { listConnectSessions, updateConnectSession } = await import(
    '../lib/research/browser-gateway/connect-session-store'
  );
  const active = await listConnectSessions('workspace-default', {
    activeOnly: true,
    portal: portalArg,
  });
  const out = [];
  for (const s of active) {
    await updateConnectSession(s.id, {
      phase: 'cancelled',
      message: 'Cancelled to protect existing Research sessions',
      finishedAt: new Date().toISOString(),
    });
    out.push({ id: s.id, portal: s.portal, was: s.phase });
  }
  console.log(JSON.stringify({ cancelled: out }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
