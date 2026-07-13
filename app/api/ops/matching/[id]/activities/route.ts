import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsEditAccess } from '@/lib/ops/auth';
import { createMatchActivity } from '@/lib/ops/matching/activity-store';
import { createMatchActivitySchema } from '@/lib/ops/matching/schemas';
import { getDatabase, getMatchRecord, updateMatchRecord } from '@/lib/ops/matching/store';

type RouteContext = { params: { id: string } };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireOpsEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { id } = context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: 'Invalid match record.' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createMatchActivitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const db = await getDatabase();
    const existing = await getMatchRecord(db, id);
    if (!existing) {
      return NextResponse.json({ error: 'Match not found.' }, { status: 404 });
    }

    const payload = parsed.data;

    if (payload.type === 'SITE_VISIT_SCHEDULED' && payload.siteVisitAt) {
      await updateMatchRecord(db, id, {
        siteVisitAt: payload.siteVisitAt,
        status: 'SITE_VISIT_SCHEDULED',
        updatedBy: auth.admin.id,
      });
    }

    if (payload.type === 'NOTE_ADDED' && body?.notes !== undefined) {
      await updateMatchRecord(db, id, {
        notes: String(body.notes),
        updatedBy: auth.admin.id,
      });
    }

    const activity = await createMatchActivity(db, {
      matchId: id,
      type: payload.type,
      message: payload.message,
      meta: payload.siteVisitAt ? { siteVisitAt: payload.siteVisitAt } : undefined,
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      actorName: auth.admin.name,
    });

    const activities = await import('@/lib/ops/matching/activity-store').then((m) =>
      m.listMatchActivities(db, id),
    );
    const match = await getMatchRecord(db, id);

    return NextResponse.json({ activity, activities, match });
  } catch (error) {
    console.error('[ops-matching] activity_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to log activity.' }, { status: 500 });
  }
}
