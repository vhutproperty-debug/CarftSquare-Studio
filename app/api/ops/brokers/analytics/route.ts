import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { queryBrokerAnalytics } from '@/lib/ops/brokers/analytics';
import { getDatabase } from '@/lib/ops/brokers/store';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!auth.ok) return denied!;

  try {
    const db = await getDatabase();
    const analytics = await queryBrokerAnalytics(db);
    await logOpsActivity({
      action: 'view_broker_analytics',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_broker_analytics',
      request,
    });
    return NextResponse.json(analytics);
  } catch (error) {
    console.error('[ops-brokers] analytics_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load analytics.' }, { status: 500 });
  }
}
