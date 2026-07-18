import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchViewAccess } from '@/lib/research/auth';
import { getResearchResultByRunId } from '@/lib/research/store/results';
import { getResearchRunById } from '@/lib/research/store/runs';
import { getResearchQueryById } from '@/lib/research/store/queries';

export const runtime = 'nodejs';

type Ctx = { params: { id: string } };

export async function GET(request: Request, { params }: Ctx) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const run = await getResearchRunById(params.id);
    if (!run) {
      return NextResponse.json({ error: 'Run not found.' }, { status: 404 });
    }
    const [result, query] = await Promise.all([
      getResearchResultByRunId(run.id),
      getResearchQueryById(run.queryId),
    ]);
    return NextResponse.json({ ok: true, run, result, query });
  } catch (error) {
    console.error('[research] run_get_failed', error);
    return NextResponse.json({ error: 'Failed to load run.' }, { status: 500 });
  }
}
