import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { brokerBatchesQuerySchema } from '@/lib/ops/brokers/schemas';
import { getDatabase, listImportBatches } from '@/lib/ops/brokers/store';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!auth.ok) return denied!;

  const { searchParams } = new URL(request.url);
  const parsed = brokerBatchesQuerySchema.safeParse({
    page: searchParams.get('page') || 1,
    pageSize: searchParams.get('pageSize') || 20,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const db = await getDatabase();
    const { items, total } = await listImportBatches(db, parsed.data.page, parsed.data.pageSize);
    return NextResponse.json({
      items,
      pagination: {
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / parsed.data.pageSize)),
      },
    });
  } catch (error) {
    console.error('[ops-brokers] batches_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load import batches.' }, { status: 500 });
  }
}
