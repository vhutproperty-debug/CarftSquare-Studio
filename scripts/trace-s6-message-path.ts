/**
 * TEMP Stage-6 probe — exercises message route awaits + handleMessage.
 * Does not change business logic. Writes only via normal handleMessage path.
 *
 * Usage:
 *   npx tsx scripts/trace-s6-message-path.ts
 *   npx tsx scripts/trace-s6-message-path.ts --dry   # stop after getAiSessionById
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

const dry = process.argv.includes('--dry');

async function main() {
  const { getResearchDatabase } = await import('../lib/research/store');
  const { RESEARCH_COLLECTIONS } = await import('../lib/research/collections');
  const { getAiSessionById } = await import('../lib/research/ai/session-store');
  const { executiveResearchAgent } = await import(
    '../lib/research/ai/executive-research-agent'
  );
  const { POST } = await import('../app/api/research/ai/sessions/[id]/message/route');

  const db = await getResearchDatabase();
  const empty = await db
    .collection(RESEARCH_COLLECTIONS.aiSessions)
    .find({ status: 'active', 'messages.0': { $exists: false } })
    .sort({ updatedAt: -1 })
    .limit(1)
    .next();

  console.log(
    JSON.stringify({
      tag: 'research-trace-s6',
      step: 'probe_empty_session',
      id: empty?.id,
      dry,
    }),
  );

  if (!empty?.id) {
    console.log(JSON.stringify({ tag: 'research-trace-s6', step: 'probe_no_empty' }));
    return;
  }

  // 1) Route without cookies → expect auth early return (proves route awaits)
  console.log(JSON.stringify({ tag: 'research-trace-s6', step: 'probe_route_unauth_start' }));
  const unauthRes = await POST(
    new Request(`http://localhost/api/research/ai/sessions/${empty.id}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Find 2 BHK rentals in Auris Serenity' }),
    }),
    { params: { id: empty.id } },
  );
  console.log(
    JSON.stringify({
      tag: 'research-trace-s6',
      step: 'probe_route_unauth_done',
      status: unauthRes.status,
      body: await unauthRes.json(),
    }),
  );

  // 2) First await inside handleMessage path
  console.log(JSON.stringify({ tag: 'research-trace-s6', step: 'probe_get_session_start' }));
  const session = await getAiSessionById(empty.id);
  console.log(
    JSON.stringify({
      tag: 'research-trace-s6',
      step: 'probe_get_session_done',
      found: Boolean(session),
      phase: session?.progress?.phase,
    }),
  );

  if (dry) {
    console.log(JSON.stringify({ tag: 'research-trace-s6', step: 'probe_dry_stop' }));
    return;
  }

  // 3) Call handleMessage exactly as the route does after auth
  console.log(JSON.stringify({ tag: 'research-trace-s6', step: 'probe_handleMessage_start' }));
  const started = Date.now();
  try {
    const result = await executiveResearchAgent.handleMessage({
      sessionId: empty.id,
      message: 'Find 2 BHK rentals in Auris Serenity',
    });
    console.log(
      JSON.stringify({
        tag: 'research-trace-s6',
        step: 'probe_handleMessage_done',
        ms: Date.now() - started,
        status: result.session.status,
        phase: result.session.progress?.phase,
        messageCount: result.session.messages?.length,
        clarification: result.clarification || null,
        assistantPreview: result.assistantMessage.slice(0, 160),
      }),
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        tag: 'research-trace-s6',
        step: 'probe_handleMessage_throw',
        ms: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack?.split('\n').slice(0, 20) : null,
      }),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
