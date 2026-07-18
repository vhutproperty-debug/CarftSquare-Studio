import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchEditAccess } from '@/lib/research/auth';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import { researchExecutionEngine } from '@/lib/research/execution/research-execution-engine';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await requireResearchEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!auth.ok) return denied!;

  try {
    const body = await request.json();
    const naturalLanguage = String(body.naturalLanguage || body.query || '').trim();
    if (!naturalLanguage) {
      return NextResponse.json({ error: 'naturalLanguage is required.' }, { status: 400 });
    }
    const workspaceId =
      typeof body.workspaceId === 'string' && body.workspaceId.trim()
        ? body.workspaceId.trim()
        : DEFAULT_RESEARCH_WORKSPACE.id;
    const title =
      typeof body.title === 'string' && body.title.trim()
        ? body.title.trim()
        : naturalLanguage.slice(0, 80);

    const { query, plan } = await researchExecutionEngine.planAndCreateQuery({
      workspaceId,
      naturalLanguage,
      createdBy: auth.admin.id,
      title,
    });

    return NextResponse.json({ ok: true, query, plan });
  } catch (error) {
    console.error('[research] plan_failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Plan failed.' },
      { status: 500 },
    );
  }
}
