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
  const id = process.argv[2];
  if (!id) {
    console.error('Usage: npx tsx scripts/check-connect-session.ts <connectSessionId>');
    process.exit(1);
  }
  const { getConnectSessionPublic } = await import('../lib/research/browser-gateway/gateway');
  const s = await getConnectSessionPublic(id);
  console.log(
    JSON.stringify(
      {
        id: s?.id,
        portal: s?.portal,
        phase: s?.phase,
        message: s?.message,
        loginUrl: s?.loginUrl,
        liveViewUrl: s?.liveViewUrl || null,
        errorMessage: s?.errorMessage || null,
      },
      null,
      2,
    ),
  );
}

main();
