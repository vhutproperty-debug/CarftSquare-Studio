import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { listBrokers } from '@/lib/ops/brokers/directory';
import { brokerDirectoryQuerySchema } from '@/lib/ops/brokers/schemas';
import { getDatabase } from '@/lib/ops/brokers/store';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!auth.ok) return denied!;

  const { searchParams } = new URL(request.url);
  const parsed = brokerDirectoryQuerySchema.safeParse({
    page: searchParams.get('page') || 1,
    pageSize: searchParams.get('pageSize') || 25,
    search: searchParams.get('search') || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const db = await getDatabase();
    const { items, total } = await listBrokers(db, {
      page: parsed.data.page ?? 1,
      pageSize: parsed.data.pageSize ?? 25,
      search: parsed.data.search,
    });
    await logOpsActivity({
      action: 'view_broker_directory',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_brokers',
      details: { page: parsed.data.page, total },
      request,
    });
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
    console.error('[ops-brokers] directory_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load broker directory.' }, { status: 500 });
  }
}
