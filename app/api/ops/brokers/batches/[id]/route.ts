import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { getBatchQualityDetail } from '@/lib/ops/brokers/batch-quality';
import { getDatabase } from '@/lib/ops/brokers/store';

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!auth.ok) return denied!;

  try {
    const db = await getDatabase();
    const detail = await getBatchQualityDetail(db, params.id);
    if (!detail) {
      return NextResponse.json({ error: 'Import batch not found.' }, { status: 404 });
    }
    // Keep V1 shape keys for compatibility
    return NextResponse.json({
      batch: detail.batch,
      sampleMessages: detail.malformedMessages.slice(0, 20),
      quality: detail,
    });
  } catch (error) {
    console.error('[ops-brokers] batch_detail_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load import batch.' }, { status: 500 });
  }
}
