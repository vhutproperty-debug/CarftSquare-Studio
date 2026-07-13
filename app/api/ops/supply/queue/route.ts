import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsEditAccess, requireOpsViewAccess } from '@/lib/ops/auth';
import { createSupplyRecordSchema, supplyQueueQuerySchema } from '@/lib/ops/supply/schemas';
import { querySupplyWorkspace } from '@/lib/ops/supply/query';
import { createSupplyRecord, getDatabase } from '@/lib/ops/supply/store';
import { isSupplyPriority, isSupplyStatus } from '@/lib/ops/supply/statuses';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const parsed = supplyQueueQuerySchema.safeParse({
    page: searchParams.get('page') || 1,
    pageSize: searchParams.get('pageSize') || 25,
    search: searchParams.get('search') || undefined,
    sort: searchParams.get('sort') || undefined,
    sortDir: searchParams.get('sortDir') || undefined,
    project: searchParams.get('project') || undefined,
    building: searchParams.get('building') || undefined,
    configuration: searchParams.get('configuration') || undefined,
    listingType: searchParams.get('listingType') || undefined,
    assignedBroker: searchParams.get('assignedBroker') || undefined,
    availabilityStatus: searchParams.get('availabilityStatus') || undefined,
    exclusive: searchParams.get('exclusive') || undefined,
    keysAvailable: searchParams.get('keysAvailable') || undefined,
    agreementExpiring: searchParams.get('agreementExpiring') || undefined,
    readyForMatching: searchParams.get('readyForMatching') || undefined,
    status: searchParams.get('status') || undefined,
    priority: searchParams.get('priority') || undefined,
    mineOnly: searchParams.get('mineOnly') || undefined,
    followUpToday: searchParams.get('followUpToday') || undefined,
    overdueOnly: searchParams.get('overdueOnly') || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const statusParam = parsed.data.status;
  const priorityParam = parsed.data.priority;

  try {
    const result = await querySupplyWorkspace({
      ...parsed.data,
      status: statusParam && isSupplyStatus(statusParam) ? statusParam : undefined,
      priority: priorityParam && isSupplyPriority(priorityParam) ? priorityParam : undefined,
    }, auth.admin);

    await logOpsActivity({
      action: 'view_supply_workspace',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_supply_workspace',
      details: { page: result.pagination.page, total: result.pagination.total },
      request,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[ops-supply] queue_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load supply workspace.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireOpsEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const parsed = createSupplyRecordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const db = await getDatabase();
    const record = await createSupplyRecord(db, parsed.data, auth.admin.id, auth.admin.email, auth.admin.name);

    await logOpsActivity({
      action: 'create_supply_record',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_supply_record',
      resourceId: record.id,
      request,
    });

    return NextResponse.json({ record }, { status: 201 });
  } catch (error) {
    console.error('[ops-supply] create_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to create supply record.' }, { status: 500 });
  }
}
