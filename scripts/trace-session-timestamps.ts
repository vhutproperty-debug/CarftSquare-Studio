/**
 * Read-only: compare createdAt vs updatedAt on recent user AI sessions.
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
  const { getResearchDatabase } = await import('../lib/research/store');
  const { RESEARCH_COLLECTIONS } = await import('../lib/research/collections');
  const db = await getResearchDatabase();
  const col = db.collection(RESEARCH_COLLECTIONS.aiSessions);
  const u = '429302ae-4f2c-451b-ae76-fb1315e95de5';
  const recent = await col
    .find({ createdBy: u })
    .sort({ updatedAt: -1 })
    .limit(12)
    .project({
      id: 1,
      title: 1,
      status: 1,
      updatedAt: 1,
      createdAt: 1,
      progress: 1,
      messages: 1,
      queryIds: 1,
      runIds: 1,
    })
    .toArray();

  for (const d of recent) {
    console.log(
      JSON.stringify({
        id: d.id,
        title: d.title,
        status: d.status,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        sameTs: d.createdAt === d.updatedAt,
        msg: (d.messages || []).length,
        phase: d.progress?.phase,
        queryIds: (d.queryIds || []).length,
        runIds: (d.runIds || []).length,
      }),
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
