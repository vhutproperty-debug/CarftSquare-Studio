import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { queryOpsDashboardStats } from '@/lib/ops/leads/query';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const stats = await queryOpsDashboardStats();
    await logOpsActivity({
      action: 'view_dashboard',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_dashboard',
      request,
    });

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('[ops-dashboard] fetch_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load dashboard.' }, { status: 500 });
  }
}
