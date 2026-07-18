import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { getBrokerInventoryDetail } from '@/lib/ops/brokers/query';
import { matchInventoryAgainstReadyDemand } from '@/lib/ops/brokers/match-adapter';

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!auth.ok) return denied!;

  try {
    const detail = await getBrokerInventoryDetail(params.id);
    if (!detail) {
      return NextResponse.json({ error: 'Broker inventory not found.' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const includeMatches = searchParams.get('includeMatches') === 'true';
    const demandMatches = includeMatches
      ? await matchInventoryAgainstReadyDemand(params.id, 15)
      : undefined;

    await logOpsActivity({
      action: 'view_broker_inventory_detail',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_broker_inventory',
      details: { inventoryId: params.id },
      request,
    });

    return NextResponse.json({ ...detail, demandMatches });
  } catch (error) {
    console.error('[ops-brokers] detail_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load broker inventory.' }, { status: 500 });
  }
}
