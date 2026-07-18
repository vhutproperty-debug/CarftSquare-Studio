import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { executiveResearchAgent } from '@/lib/research/ai/executive-research-agent';
import { requireResearchViewAccess } from '@/lib/research/auth';

export const runtime = 'nodejs';

type Ctx = { params: { id: string } };

export async function GET(request: Request, { params }: Ctx) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const session = await executiveResearchAgent.getSession(params.id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      session: {
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
        auditLog: session.auditLog,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    });
  } catch (error) {
    console.error('[research] ai_session_get_failed', error);
    return NextResponse.json({ error: 'Failed to load session.' }, { status: 500 });
  }
}
