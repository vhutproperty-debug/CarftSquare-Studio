import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { computeDealMetrics } from '@/lib/ops/deals/query';
import { getDatabase, listDealRecords } from '@/lib/ops/deals/store';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const db = await getDatabase();
    const deals = await listDealRecords(db);
    const metrics = computeDealMetrics(deals);

    await logOpsActivity({
      action: 'view_deal_workspace',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_deal_metrics',
      request,
    });

    return NextResponse.json({ metrics });
  } catch (error) {
    console.error('[ops-deals] metrics_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load deal metrics.' }, { status: 500 });
  }
}
