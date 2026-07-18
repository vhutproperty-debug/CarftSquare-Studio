import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchEditAccess, requireResearchViewAccess } from '@/lib/research/auth';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import { researchExecutionEngine } from '@/lib/research/execution/research-execution-engine';
import { getResearchResultByRunId } from '@/lib/research/store/results';
import { listResearchRuns } from '@/lib/research/store/runs';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId') || DEFAULT_RESEARCH_WORKSPACE.id;

  try {
    const runs = await listResearchRuns(workspaceId);
    return NextResponse.json({ ok: true, runs });
  } catch (error) {
    console.error('[research] runs_list_failed', error);
    return NextResponse.json({ error: 'Failed to list runs.' }, { status: 500 });
  }
}

/** Create a plan (optional) and execute research across authenticated portals. */
export async function POST(request: Request) {
  const auth = await requireResearchEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!auth.ok) return denied!;

  try {
    const body = await request.json();
    const workspaceId =
      typeof body.workspaceId === 'string' && body.workspaceId.trim()
        ? body.workspaceId.trim()
        : DEFAULT_RESEARCH_WORKSPACE.id;

    let queryId = typeof body.queryId === 'string' ? body.queryId : '';
    if (!queryId) {
      const naturalLanguage = String(body.naturalLanguage || body.query || '').trim();
      if (!naturalLanguage) {
        return NextResponse.json(
          { error: 'naturalLanguage or queryId is required.' },
          { status: 400 },
        );
      }
      const planned = await researchExecutionEngine.planAndCreateQuery({
        workspaceId,
        naturalLanguage,
        createdBy: auth.admin.id,
        title: typeof body.title === 'string' ? body.title : undefined,
      });
      queryId = planned.query.id;
    }

    const { run, listings } = await researchExecutionEngine.executeQuery(queryId);
    const result = await getResearchResultByRunId(run.id);
    return NextResponse.json({
      ok: true,
      run,
      listings,
      result,
    });
  } catch (error) {
    console.error('[research] run_failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Research run failed.' },
      { status: 500 },
    );
  }
}
