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
  const id = process.argv[2] || '0188df9a-0771-4d66-b23a-33d5a5d51144';
  const { getConnectSessionById } = await import(
    '../lib/research/browser-gateway/connect-session-store'
  );
  const s = await getConnectSessionById(id);
  console.log(
    JSON.stringify(
      {
        id: s?.id,
        portal: s?.portal,
        phase: s?.phase,
        liveViewUrl: Boolean(s?.liveViewUrl),
        liveViewUrlPreview: s?.liveViewUrl?.slice(0, 120) || null,
        message: s?.message,
        loginUrl: s?.loginUrl,
        updatedAt: s?.updatedAt,
        expiresAt: s?.expiresAt,
      },
      null,
      2,
    ),
  );
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
