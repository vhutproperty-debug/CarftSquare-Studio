import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { queryDemandWorkspace } from '@/lib/ops/demand/query';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const result = await queryDemandWorkspace({ page: 1, pageSize: 500 }, auth.admin);
    return NextResponse.json({
      metrics: result.metrics,
      sourceBreakdown: result.sourceBreakdown,
    });
  } catch (error) {
    console.error('[ops-demand] metrics_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load demand metrics.' }, { status: 500 });
  }
}
