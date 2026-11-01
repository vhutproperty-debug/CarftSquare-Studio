import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { queryMarketOverview } from '@/lib/ops/market/query';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  if (!auth.ok) {
    return authResultToResponse(auth) ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const overview = await queryMarketOverview();
    await logOpsActivity({
      action: 'view_market_board',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_market_board',
      details: {
        flats: overview.summary.availableFlats,
        requirements: overview.summary.activeRequirements,
      },
      request,
    });
    return NextResponse.json(overview);
  } catch (error) {
    console.error('[ops-market] overview_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load the matching board.' }, { status: 500 });
  }
}
