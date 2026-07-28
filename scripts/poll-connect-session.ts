/**
 * Poll one Connect session until terminal phase.
 *   npx tsx scripts/poll-connect-session.ts --session=<id> [--timeout=150]
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

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

async function main() {
  const id = arg('session');
  if (!id) {
    console.error('Need --session=<connectSessionId>');
    process.exit(2);
  }
  const timeoutSec = Number(arg('timeout') || 150);
  const { getConnectSessionPublic } = await import('../lib/research/browser-gateway/gateway');

  const deadline = Date.now() + timeoutSec * 1000;
  let last = '';
  let final: unknown = null;
  while (Date.now() < deadline) {
    const s = await getConnectSessionPublic(id);
    final = s;
    const line = JSON.stringify({
      phase: s?.phase,
      message: s?.message,
      error: s?.errorMessage || null,
    });
    if (line !== last) {
      last = line;
      console.log(new Date().toISOString().slice(11, 19), line);
    }
    if (['connected', 'failed', 'cancelled', 'expired'].includes(s?.phase || '')) break;
    await new Promise((r) => setTimeout(r, 4000));
  }
  console.log(JSON.stringify(final, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
