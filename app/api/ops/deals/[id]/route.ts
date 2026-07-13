import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsEditAccess, requireOpsViewAccess } from '@/lib/ops/auth';
import { createDealActivity } from '@/lib/ops/deals/activity-store';
import { getDealDetail } from '@/lib/ops/deals/query';
import { patchDealRecordSchema } from '@/lib/ops/deals/schemas';
import { DEAL_STAGE_LABELS, STAGE_PROBABILITY } from '@/lib/ops/deals/statuses';
import { getDatabase, getDealRecord, updateDealRecord } from '@/lib/ops/deals/store';
import { listOpsTeamMembers } from '@/lib/ops/calls/query';

type RouteContext = { params: { id: string } };

const STAGE_ACTIVITY: Partial<Record<string, 'SITE_VISIT_SCHEDULED' | 'SITE_VISIT_COMPLETED' | 'TOKEN_RECEIVED' | 'AGREEMENT_COMPLETED' | 'COMMISSION_RECEIVED' | 'LOST'>> = {
  SITE_VISIT_SCHEDULED: 'SITE_VISIT_SCHEDULED',
  SITE_VISIT_COMPLETED: 'SITE_VISIT_COMPLETED',
  TOKEN_RECEIVED: 'TOKEN_RECEIVED',
  AGREEMENT_COMPLETED: 'AGREEMENT_COMPLETED',
  COMMISSION_RECEIVED: 'COMMISSION_RECEIVED',
  LOST: 'LOST',
};

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { id } = context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: 'Invalid deal record.' }, { status: 400 });
  }

  try {
    const detail = await getDealDetail(id, auth.admin);
    if (!detail) {
      return NextResponse.json({ error: 'Deal not found.' }, { status: 404 });
    }

    await logOpsActivity({
      action: 'view_deal_record',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_deal_record',
      resourceId: id,
      request,
    });

    return NextResponse.json(detail);
  } catch (error) {
    console.error('[ops-deals] detail_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load deal.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireOpsEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { id } = context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: 'Invalid deal record.' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchDealRecordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const db = await getDatabase();
    const existing = await getDealRecord(db, id);
    if (!existing) {
      return NextResponse.json({ error: 'Deal not found.' }, { status: 404 });
    }

    const team = await listOpsTeamMembers(db);
    const teamMap = new Map(team.map((m) => [m.id, m]));
    const patch = parsed.data;
    const updatePayload: Parameters<typeof updateDealRecord>[2] = {
      updatedBy: auth.admin.id,
    };

    const scalarFields = [
      'clientName', 'ownerName', 'project', 'building', 'flat', 'transactionType',
      'expectedRent', 'expectedSaleValue', 'expectedBrokerage', 'interiorOpportunity',
      'offerAmount', 'negotiationNotes', 'agreementValue', 'actualBrokerage',
      'paymentStatus', 'commissionCollected', 'lostReason', 'internalNotes', 'probability',
    ] as const;

    for (const field of scalarFields) {
      if (patch[field] !== undefined) {
        (updatePayload as Record<string, unknown>)[field] = patch[field];
      }
    }

    if (patch.stage) {
      updatePayload.stage = patch.stage;
      if (patch.probability === undefined) {
        updatePayload.probability = STAGE_PROBABILITY[patch.stage];
      }
    }

    if (patch.documentsChecklist) {
      updatePayload.documentsChecklist = {
        ...existing.documentsChecklist,
        ...patch.documentsChecklist,
      };
    }

    if (patch.targetClosingDate !== undefined) {
      updatePayload.targetClosingDate = patch.targetClosingDate || null;
    }
    if (patch.siteVisitDate !== undefined) {
      updatePayload.siteVisitDate = patch.siteVisitDate || null;
    }
    if (patch.agreementDate !== undefined) {
      updatePayload.agreementDate = patch.agreementDate || null;
    }

    if (patch.broker !== undefined) {
      if (patch.broker === '') {
        updatePayload.broker = null;
        updatePayload.brokerName = null;
      } else {
        updatePayload.broker = patch.broker;
        updatePayload.brokerName = teamMap.get(patch.broker)?.name || patch.broker;
      }
    }

    const deal = await updateDealRecord(db, id, updatePayload);
    if (!deal) {
      return NextResponse.json({ error: 'Unable to update deal.' }, { status: 500 });
    }

    if (patch.stage && patch.stage !== existing.stage) {
      await createDealActivity(db, {
        dealId: id,
        type: 'STAGE_CHANGED',
        message: `Stage changed to ${DEAL_STAGE_LABELS[patch.stage]}`,
        meta: { from: existing.stage, to: patch.stage },
        actorId: auth.admin.id,
        actorEmail: auth.admin.email,
        actorName: auth.admin.name,
      });

      const activityType = STAGE_ACTIVITY[patch.stage];
      if (activityType) {
        await createDealActivity(db, {
          dealId: id,
          type: activityType,
          message: DEAL_STAGE_LABELS[patch.stage],
          actorId: auth.admin.id,
          actorEmail: auth.admin.email,
          actorName: auth.admin.name,
        });
      }
    }

    if (patch.offerAmount !== undefined && patch.offerAmount !== existing.offerAmount) {
      await createDealActivity(db, {
        dealId: id,
        type: 'OFFER_UPDATED',
        message: `Offer updated to ${patch.offerAmount || '—'}`,
        actorId: auth.admin.id,
        actorEmail: auth.admin.email,
        actorName: auth.admin.name,
      });
    }

    if (patch.documentsChecklist) {
      await createDealActivity(db, {
        dealId: id,
        type: 'DOCUMENT_UPDATED',
        message: 'Documents checklist updated',
        actorId: auth.admin.id,
        actorEmail: auth.admin.email,
        actorName: auth.admin.name,
      });
    }

    if (patch.broker !== undefined && patch.broker !== (existing.broker || '')) {
      await createDealActivity(db, {
        dealId: id,
        type: 'ASSIGNED',
        message: patch.broker
          ? `Assigned to ${updatePayload.brokerName || patch.broker}`
          : 'Assignment cleared',
        actorId: auth.admin.id,
        actorEmail: auth.admin.email,
        actorName: auth.admin.name,
      });
    }

    if (patch.internalNotes !== undefined && patch.internalNotes !== existing.internalNotes) {
      await createDealActivity(db, {
        dealId: id,
        type: 'NOTE_ADDED',
        message: 'Internal notes updated',
        actorId: auth.admin.id,
        actorEmail: auth.admin.email,
        actorName: auth.admin.name,
      });
    }

    await logOpsActivity({
      action: 'update_deal_record',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_deal_record',
      resourceId: id,
      details: { fields: Object.keys(patch) },
      request,
    });

    const activities = await import('@/lib/ops/deals/activity-store').then((m) =>
      m.listDealActivities(db, id),
    );

    return NextResponse.json({ deal, activities });
  } catch (error) {
    console.error('[ops-deals] patch_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to update deal.' }, { status: 500 });
  }
}
