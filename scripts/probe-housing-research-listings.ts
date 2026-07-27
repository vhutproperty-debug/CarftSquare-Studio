/** Compare Housing broad vs project-scoped Research search. */
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
  const { requirePortalConnector } = await import('../connectors/registry');
  const c = requirePortalConnector('housing');
  const v = await c.validateSession('workspace-default');
  console.log(JSON.stringify({ validate: { ok: v.ok, status: v.status, message: v.message } }));
  if (!v.ok) process.exit(1);

  const broad = await c.executeSearch({
    workspaceId: 'workspace-default',
    sessionId: v.sessionId,
    skipValidation: true,
    criteria: { city: 'Mumbai', bhk: 3, transactionType: 'RENT', portals: ['housing'] },
  });
  console.log(
    JSON.stringify({
      broad: {
        ok: broad.ok,
        n: broad.listings?.length ?? 0,
        msg: broad.message,
        degraded: Boolean(broad.degraded),
        sample: (broad.listings || []).slice(0, 3).map((l) => ({
          title: l.title,
          url: l.url,
        })),
      },
    }),
  );

  const withProject = await c.executeSearch({
    workspaceId: 'workspace-default',
    sessionId: v.sessionId,
    skipValidation: true,
    criteria: {
      city: 'Mumbai',
      bhk: 2, // intentional mismatch — soft fallback should still return 3 BHK cards
      transactionType: 'RENT',
      portals: ['housing'],
      project: 'Oberoi Sky City',
    },
  });
  console.log(
    JSON.stringify({
      project: {
        ok: withProject.ok,
        n: withProject.listings?.length ?? 0,
        msg: withProject.message,
        degraded: Boolean(withProject.degraded),
        sampleBhk: (withProject.listings || []).slice(0, 3).map((l) => l.bhk),
      },
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
