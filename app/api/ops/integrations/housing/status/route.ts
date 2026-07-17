import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { queryHousingIntegrationStatus } from '@/lib/ops/integrations/housing/housing.query';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!auth.ok) return denied!;

  try {
    const status = await queryHousingIntegrationStatus();
    await logOpsActivity({
      action: 'view_housing_integration_status',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_housing_status',
      request,
    });
    return NextResponse.json(status);
  } catch (error) {
    console.error('[ops-housing] status_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load Housing.com integration status.' }, { status: 500 });
  }
}
