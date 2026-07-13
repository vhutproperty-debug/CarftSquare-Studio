import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { queryOpsIntelligence } from '@/lib/ops/intelligence/query';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const overview = await queryOpsIntelligence();
    await logOpsActivity({
      action: 'view_ops_intelligence',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_intelligence_overview',
      request,
    });
    return NextResponse.json(overview);
  } catch (error) {
    console.error('[ops-intelligence] overview_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load operations intelligence.' }, { status: 500 });
  }
}
