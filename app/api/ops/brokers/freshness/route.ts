import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsEditAccess } from '@/lib/ops/auth';
import { getDatabase, recalculateAllFreshness } from '@/lib/ops/brokers/store';

export const maxDuration = 120;
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await requireOpsEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!auth.ok) return denied!;

  try {
    const db = await getDatabase();
    const result = await recalculateAllFreshness(db);

    await logOpsActivity({
      action: 'broker_freshness_recalculated',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_broker_inventory',
      details: result,
      request,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[ops-brokers] freshness_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to recalculate freshness.' }, { status: 500 });
  }
}
