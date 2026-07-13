import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsEditAccess } from '@/lib/ops/auth';
import { createDealActivity } from '@/lib/ops/deals/activity-store';
import { createDealActivitySchema } from '@/lib/ops/deals/schemas';
import { STAGE_PROBABILITY } from '@/lib/ops/deals/statuses';
import { getDatabase, getDealRecord, updateDealRecord } from '@/lib/ops/deals/store';

type RouteContext = { params: { id: string } };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireOpsEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { id } = context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: 'Invalid deal record.' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createDealActivitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const db = await getDatabase();
    const existing = await getDealRecord(db, id);
    if (!existing) {
      return NextResponse.json({ error: 'Deal not found.' }, { status: 404 });
    }

    const payload = parsed.data;

    if (payload.type === 'SITE_VISIT_SCHEDULED' && payload.siteVisitDate) {
      await updateDealRecord(db, id, {
        siteVisitDate: payload.siteVisitDate,
        stage: 'SITE_VISIT_SCHEDULED',
        probability: STAGE_PROBABILITY.SITE_VISIT_SCHEDULED,
        updatedBy: auth.admin.id,
      });
    }

    if (payload.type === 'SITE_VISIT_COMPLETED') {
      await updateDealRecord(db, id, {
        stage: 'SITE_VISIT_COMPLETED',
        probability: STAGE_PROBABILITY.SITE_VISIT_COMPLETED,
        updatedBy: auth.admin.id,
      });
    }

    if (payload.type === 'TOKEN_RECEIVED') {
      await updateDealRecord(db, id, {
        stage: 'TOKEN_RECEIVED',
        probability: STAGE_PROBABILITY.TOKEN_RECEIVED,
        updatedBy: auth.admin.id,
      });
    }

    if (payload.type === 'AGREEMENT_COMPLETED') {
      await updateDealRecord(db, id, {
        stage: 'AGREEMENT_COMPLETED',
        probability: STAGE_PROBABILITY.AGREEMENT_COMPLETED,
        updatedBy: auth.admin.id,
      });
    }

    if (payload.type === 'COMMISSION_RECEIVED') {
      await updateDealRecord(db, id, {
        stage: 'COMMISSION_RECEIVED',
        paymentStatus: 'COLLECTED',
        probability: STAGE_PROBABILITY.COMMISSION_RECEIVED,
        updatedBy: auth.admin.id,
      });
    }

    if (payload.type === 'LOST') {
      await updateDealRecord(db, id, {
        stage: 'LOST',
        probability: 0,
        lostReason: body?.lostReason || 'Deal marked lost',
        updatedBy: auth.admin.id,
      });
    }

    const activity = await createDealActivity(db, {
      dealId: id,
      type: payload.type,
      message: payload.message,
      meta: payload.siteVisitDate ? { siteVisitDate: payload.siteVisitDate } : undefined,
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      actorName: auth.admin.name,
    });

    const activities = await import('@/lib/ops/deals/activity-store').then((m) =>
      m.listDealActivities(db, id),
    );
    const deal = await getDealRecord(db, id);

    return NextResponse.json({ activity, activities, deal });
  } catch (error) {
    console.error('[ops-deals] activity_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to log activity.' }, { status: 500 });
  }
}
