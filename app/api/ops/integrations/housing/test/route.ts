import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsEditAccess } from '@/lib/ops/auth';
import { triggerHousingIntegrationTest } from '@/lib/ops/integrations/housing/housing.query';

export async function POST(request: Request) {
  const auth = await requireOpsEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!auth.ok) return denied!;

  try {
    const result = await triggerHousingIntegrationTest(auth.admin.id);
    await logOpsActivity({
      action: 'test_housing_connector',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_housing_test',
      details: {
        success: result.success,
        authOk: result.authOk,
        apiResponseStatus: result.apiResponseStatus,
        logId: result.logId,
        durationMs: result.durationMs,
      },
      request,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[ops-housing] test_failed', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to test Housing.com connection.' },
      { status: 500 },
    );
  }
}
