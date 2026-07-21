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
  const since = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
  const all = await col
    .find({ updatedAt: { $gte: since } })
    .project({
      id: 1,
      title: 1,
      status: 1,
      updatedAt: 1,
      createdAt: 1,
      progress: 1,
      messages: 1,
      clarificationQuestion: 1,
      createdBy: 1,
    })
    .sort({ updatedAt: -1 })
    .toArray();

  const summary = all.map((d) => ({
    id: d.id,
    title: d.title,
    status: d.status,
    createdBy: d.createdBy,
    updatedAt: d.updatedAt,
    msgCount: (d.messages || []).length,
    phase: d.progress?.phase,
    progressMsg: d.progress?.message,
    hasUser: (d.messages || []).some((m: { role: string }) => m.role === 'user'),
  }));

  console.log(
    JSON.stringify(
      {
        count: summary.length,
        withMessages: summary.filter((s) => s.msgCount > 0).length,
        empty: summary.filter((s) => s.msgCount === 0).length,
        rows: summary,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
