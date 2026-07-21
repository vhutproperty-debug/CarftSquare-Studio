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
  const failed = await col.findOne({ id: '910a89aa-0c3c-4432-bbb2-802c671e483e' });
  console.log(
    JSON.stringify(
      {
        id: failed?.id,
        status: failed?.status,
        progress: failed?.progress,
        assumptions: failed?.assumptions,
        auditTail: (failed?.auditLog || []).slice(-8),
        lastMessages: (failed?.messages || []).slice(-4).map((m: { role: string; content: string }) => ({
          role: m.role,
          content: String(m.content || '').slice(0, 240),
        })),
        listingCount: failed?.listings?.length,
        reportWarnings: failed?.report?.warnings,
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
