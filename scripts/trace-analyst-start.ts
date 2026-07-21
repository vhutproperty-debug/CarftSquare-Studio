/**
 * Read-only trace: run ExecutiveResearchAgent.handleMessage against latest empty session.
 * Does NOT fix anything — proves whether orchestration can start.
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
process.env.VERCEL = '1';

async function main() {
  const { getResearchDatabase } = await import('../lib/research/store');
  const { RESEARCH_COLLECTIONS } = await import('../lib/research/collections');
  const { executiveResearchAgent } = await import('../lib/research/ai/executive-research-agent');

  const db = await getResearchDatabase();
  const col = db.collection(RESEARCH_COLLECTIONS.aiSessions);
  const empty = await col
    .find({ status: 'active', 'messages.0': { $exists: false } })
    .sort({ updatedAt: -1 })
    .limit(1)
    .next();

  console.log(
    'EMPTY_SESSION',
    JSON.stringify({
      id: empty?.id,
      status: empty?.status,
      phase: empty?.progress?.phase,
      messageCount: empty?.messages?.length || 0,
    }),
  );

  if (!empty?.id) {
    console.log('NO_EMPTY_SESSION');
    return;
  }

  // Dry-run intent only first
  const { understandResearchIntent } = await import('../lib/research/ai/intent');
  const intent = understandResearchIntent('Find 2 BHK rentals in Auris Serenity');
  console.log('INTENT', JSON.stringify(intent));

  console.log('CALLING_HANDLE_MESSAGE');
  const started = Date.now();
  try {
    const result = await executiveResearchAgent.handleMessage({
      sessionId: empty.id,
      message: 'Find 2 BHK rentals in Auris Serenity',
    });
    console.log(
      'HANDLE_MESSAGE_DONE',
      JSON.stringify({
        ms: Date.now() - started,
        status: result.session.status,
        phase: result.session.progress?.phase,
        messageCount: result.session.messages?.length,
        listingCount: result.session.listings?.length,
        clarification: result.clarification,
        assistantPreview: result.assistantMessage.slice(0, 200),
        portals: result.session.report?.portalsSearched,
      }),
    );
  } catch (err) {
    console.log(
      'HANDLE_MESSAGE_FAIL',
      JSON.stringify({
        ms: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack?.split('\n').slice(0, 6) : null,
      }),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
