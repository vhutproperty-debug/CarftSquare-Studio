import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import {
  computeMatchingMetrics,
  getEligibleDemandRecords,
  getEligibleSupplyRecords,
} from '@/lib/ops/matching/query';
import { getDatabase, listMatchRecords } from '@/lib/ops/matching/store';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const db = await getDatabase();
    const [eligibleDemand, eligibleSupply, matches] = await Promise.all([
      getEligibleDemandRecords(db),
      getEligibleSupplyRecords(db),
      listMatchRecords(db),
    ]);

    const metrics = computeMatchingMetrics(eligibleDemand.length, eligibleSupply.length, matches);

    await logOpsActivity({
      action: 'view_matching_workspace',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_matching_metrics',
      request,
    });

    return NextResponse.json({ metrics });
  } catch (error) {
    console.error('[ops-matching] metrics_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load matching metrics.' }, { status: 500 });
  }
}
