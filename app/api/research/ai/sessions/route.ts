import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { executiveResearchAgent } from '@/lib/research/ai/executive-research-agent';
import { requireResearchEditAccess, requireResearchViewAccess } from '@/lib/research/auth';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId') || DEFAULT_RESEARCH_WORKSPACE.id;

  try {
    const sessions = await executiveResearchAgent.listSessions(workspaceId);
    return NextResponse.json({
      ok: true,
      sessions: sessions.map(publicSession),
    });
  } catch (error) {
    console.error('[research] ai_sessions_list_failed', error);
    return NextResponse.json({ error: 'Failed to list research sessions.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireResearchEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!auth.ok) return denied!;

  try {
    const body = await request.json().catch(() => ({}));
    const workspaceId =
      typeof body.workspaceId === 'string' && body.workspaceId.trim()
        ? body.workspaceId.trim()
        : DEFAULT_RESEARCH_WORKSPACE.id;
    const session = await executiveResearchAgent.createSession({
      workspaceId,
      createdBy: auth.admin.id,
      title: typeof body.title === 'string' ? body.title : undefined,
    });
    return NextResponse.json({ ok: true, session: publicSession(session) });
  } catch (error) {
    console.error('[research] ai_session_create_failed', error);
    return NextResponse.json({ error: 'Failed to create research session.' }, { status: 500 });
  }
}

function publicSession(session: Awaited<ReturnType<typeof executiveResearchAgent.createSession>>) {
  return {
    id: session.id,
    workspaceId: session.workspaceId,
    title: session.title,
    status: session.status,
    goals: session.goals,
    filters: session.filters,
    exclusions: session.exclusions,
    assumptions: session.assumptions,
    messages: session.messages,
    progress: session.progress,
    listings: session.listings,
    report: session.report,
    clarificationQuestion: session.clarificationQuestion,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    // auditLog intentionally omitted from default list payloads
  };
}
