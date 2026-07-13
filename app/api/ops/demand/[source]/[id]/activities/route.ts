import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsEditAccess } from '@/lib/ops/auth';
import { createDemandActivity } from '@/lib/ops/demand/activity-store';
import { createDemandActivitySchema } from '@/lib/ops/demand/schemas';
import { updateDemandRecord } from '@/lib/ops/demand/store';
import { getDatabase } from '@/lib/ops/demand/store';
import { fetchUnifiedLeadBySourceId } from '@/lib/ops/leads/query';
import { isOpsLeadSource } from '@/lib/ops/leads/types';

type RouteContext = { params: { source: string; id: string } };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireOpsEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { source, id } = context.params;
  if (!isOpsLeadSource(source) || !id?.trim()) {
    return NextResponse.json({ error: 'Invalid demand record.' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createDemandActivitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const db = await getDatabase();
    const lead = await fetchUnifiedLeadBySourceId(source, id, db);
    if (!lead) {
      return NextResponse.json({ error: 'Enquiry not found.' }, { status: 404 });
    }

    const activity = await createDemandActivity(db, {
      source,
      sourceId: id,
      type: parsed.data.type,
      message: parsed.data.message,
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      actorName: auth.admin.name,
    });

    if (parsed.data.type === 'FOLLOW_UP_SCHEDULED' && parsed.data.nextFollowUpAt) {
      await updateDemandRecord(db, source, id, {
        nextFollowUpAt: parsed.data.nextFollowUpAt,
        status: 'FOLLOW_UP',
        updatedBy: auth.admin.id,
      });
    }

    if (parsed.data.type === 'FOLLOW_UP_COMPLETED') {
      await updateDemandRecord(db, source, id, {
        followUpCompletedAt: new Date().toISOString(),
        nextFollowUpAt: null,
        updatedBy: auth.admin.id,
      });
    }

    const activities = await import('@/lib/ops/demand/activity-store').then((m) =>
      m.listDemandActivities(db, source, id),
    );

    return NextResponse.json({ activity, activities }, { status: 201 });
  } catch (error) {
    console.error('[ops-demand] activity_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to log activity.' }, { status: 500 });
  }
}
