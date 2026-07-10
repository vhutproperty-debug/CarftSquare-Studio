import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { getCallWorkspaceMetrics } from '@/lib/ops/calls/query';
import { getDatabase } from '@/lib/ops/calls/activity-store';
import { requireOpsViewAccess } from '@/lib/ops/auth';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const db = await getDatabase();
    const metrics = await getCallWorkspaceMetrics(db, auth.admin);
    return NextResponse.json({ metrics });
  } catch (error) {
    console.error('[ops-calls] metrics_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load call metrics.' }, { status: 500 });
  }
}
