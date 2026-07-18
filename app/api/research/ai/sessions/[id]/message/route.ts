import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { executiveResearchAgent } from '@/lib/research/ai/executive-research-agent';
import { requireResearchEditAccess } from '@/lib/research/auth';

export const runtime = 'nodejs';
export const maxDuration = 300;

type Ctx = { params: { id: string } };

export async function POST(request: Request, { params }: Ctx) {
  const auth = await requireResearchEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const body = await request.json();
    const message = String(body.message || body.query || '').trim();
    if (!message) {
      return NextResponse.json({ error: 'message is required.' }, { status: 400 });
    }

    const result = await executiveResearchAgent.handleMessage({
      sessionId: params.id,
      message,
    });

    return NextResponse.json({
      ok: true,
      assistantMessage: result.assistantMessage,
      clarification: result.clarification,
      session: {
        id: result.session.id,
        title: result.session.title,
        status: result.session.status,
        goals: result.session.goals,
        filters: result.session.filters,
        exclusions: result.session.exclusions,
        assumptions: result.session.assumptions,
        messages: result.session.messages,
        progress: result.session.progress,
        listings: result.session.listings,
        report: result.session.report,
        clarificationQuestion: result.session.clarificationQuestion,
        updatedAt: result.session.updatedAt,
      },
    });
  } catch (error) {
    console.error('[research] ai_message_failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Research failed.' },
      { status: 500 },
    );
  }
}
