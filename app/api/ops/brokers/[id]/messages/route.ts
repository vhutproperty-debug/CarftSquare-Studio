import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { getBrokerInventoryDetail } from '@/lib/ops/brokers/query';

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
    return NextResponse.json({
      inventoryId: detail.inventory.id,
      sourceMessages: detail.sourceMessages,
    });
  } catch (error) {
    console.error('[ops-brokers] messages_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load source messages.' }, { status: 500 });
  }
}
