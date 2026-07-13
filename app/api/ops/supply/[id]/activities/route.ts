import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsEditAccess } from '@/lib/ops/auth';
import { createSupplyActivity } from '@/lib/ops/supply/activity-store';
import { createSupplyActivitySchema } from '@/lib/ops/supply/schemas';
import { getDatabase, getSupplyRecord, updateSupplyRecord } from '@/lib/ops/supply/store';

type RouteContext = { params: { id: string } };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireOpsEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { id } = context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: 'Invalid supply record.' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSupplyActivitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const db = await getDatabase();
    const existing = await getSupplyRecord(db, id);
    if (!existing) {
      return NextResponse.json({ error: 'Supply record not found.' }, { status: 404 });
    }

    const payload = parsed.data;

    if (payload.type === 'OWNER_CALLED') {
      await updateSupplyRecord(db, id, {
        lastContactAt: new Date().toISOString(),
        updatedBy: auth.admin.id,
      });
    }

    if (payload.type === 'FOLLOW_UP_SCHEDULED' && payload.nextFollowUpAt) {
      await updateSupplyRecord(db, id, {
        nextFollowUpAt: payload.nextFollowUpAt,
        updatedBy: auth.admin.id,
      });
    }

    if (payload.type === 'FOLLOW_UP_COMPLETED') {
      await updateSupplyRecord(db, id, {
        followUpCompletedAt: new Date().toISOString(),
        nextFollowUpAt: null,
        updatedBy: auth.admin.id,
      });
    }

    if (payload.type === 'VERIFIED') {
      await updateSupplyRecord(db, id, {
        status: 'VERIFIED',
        updatedBy: auth.admin.id,
      });
    }

    if (payload.type === 'NOTE_ADDED' && body?.internalNotes !== undefined) {
      await updateSupplyRecord(db, id, {
        internalNotes: String(body.internalNotes),
        updatedBy: auth.admin.id,
      });
    }

    const activity = await createSupplyActivity(db, {
      supplyId: id,
      type: payload.type,
      message: payload.message,
      meta: payload.nextFollowUpAt ? { nextFollowUpAt: payload.nextFollowUpAt } : undefined,
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      actorName: auth.admin.name,
    });

    const activities = await import('@/lib/ops/supply/activity-store').then((m) =>
      m.listSupplyActivities(db, id),
    );

    const record = await getSupplyRecord(db, id);

    return NextResponse.json({ activity, activities, record });
  } catch (error) {
    console.error('[ops-supply] activity_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to log activity.' }, { status: 500 });
  }
}
