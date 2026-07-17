import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { housingLogsQuerySchema } from '@/lib/ops/integrations/housing/housing.schemas';
import { queryHousingIntegrationLogs } from '@/lib/ops/integrations/housing/housing.query';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!auth.ok) return denied!;

  const { searchParams } = new URL(request.url);
  const parsed = housingLogsQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await queryHousingIntegrationLogs(parsed.data.limit);
    await logOpsActivity({
      action: 'view_housing_integration_logs',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_housing_logs',
      request,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[ops-housing] logs_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load Housing.com sync logs.' }, { status: 500 });
  }
}
