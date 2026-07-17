import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsEditAccess } from '@/lib/ops/auth';
import { triggerHousingIntegrationSync } from '@/lib/ops/integrations/housing/housing.query';

export async function POST(request: Request) {
  const auth = await requireOpsEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!auth.ok) return denied!;

  try {
    const result = await triggerHousingIntegrationSync(auth.admin.id);
    await logOpsActivity({
      action: 'sync_housing_connector',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_housing_sync',
      details: {
        success: result.success,
        authOk: result.authOk,
        apiResponseStatus: result.apiResponseStatus,
        logId: result.logId,
        imported: result.imported,
        updated: result.updated,
        leadsFetched: result.leadsFetched,
        durationMs: result.durationMs,
      },
      request,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[ops-housing] sync_failed', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to sync Housing.com leads.' },
      { status: 500 },
    );
  }
}
