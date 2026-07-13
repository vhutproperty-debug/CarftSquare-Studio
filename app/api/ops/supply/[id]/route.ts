import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsEditAccess, requireOpsViewAccess } from '@/lib/ops/auth';
import { createSupplyActivity } from '@/lib/ops/supply/activity-store';
import { getSupplyDetail } from '@/lib/ops/supply/query';
import { patchSupplyRecordSchema } from '@/lib/ops/supply/schemas';
import { SUPPLY_STATUS_LABELS } from '@/lib/ops/supply/statuses';
import { getDatabase, getSupplyRecord, updateSupplyRecord } from '@/lib/ops/supply/store';
import { listOpsTeamMembers } from '@/lib/ops/calls/query';
import { normalizeIndianMobile } from '@/lib/phone/indian-mobile';

type RouteContext = { params: { id: string } };

function normalizeEmail(email?: string | null): string | undefined {
  const value = email?.trim().toLowerCase();
  return value || undefined;
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { id } = context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: 'Invalid supply record.' }, { status: 400 });
  }

  try {
    const detail = await getSupplyDetail(id, auth.admin);
    if (!detail) {
      return NextResponse.json({ error: 'Supply record not found.' }, { status: 404 });
    }

    await logOpsActivity({
      action: 'view_supply_record',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_supply_record',
      resourceId: id,
      request,
    });

    return NextResponse.json(detail);
  } catch (error) {
    console.error('[ops-supply] detail_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load supply record.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireOpsEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { id } = context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: 'Invalid supply record.' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSupplyRecordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const db = await getDatabase();
    const existing = await getSupplyRecord(db, id);
    if (!existing) {
      return NextResponse.json({ error: 'Supply record not found.' }, { status: 404 });
    }

    const team = await listOpsTeamMembers(db);
    const teamMap = new Map(team.map((m) => [m.id, m]));
    const patch = parsed.data;
    const updatePayload: Parameters<typeof updateSupplyRecord>[2] = {
      updatedBy: auth.admin.id,
    };

    const scalarFields = [
      'propertyType', 'listingType', 'project', 'building', 'wing', 'flatNumber',
      'configuration', 'carpetArea', 'floor', 'facing', 'parking', 'ownerName',
      'ownerMobile', 'ownerEmail', 'source', 'exclusive', 'expectedRent',
      'expectedDeposit', 'expectedSalePrice', 'brokeragePercent', 'furnishedStatus',
      'keysAvailable', 'tenantOccupied', 'possessionStatus', 'priority', 'status',
      'availabilityStatus', 'readyForMatching', 'internalNotes',
    ] as const;

    for (const field of scalarFields) {
      if (patch[field] !== undefined) {
        (updatePayload as Record<string, unknown>)[field] = patch[field];
      }
    }

    if (patch.ownerMobile !== undefined) {
      updatePayload.normalizedOwnerMobile = normalizeIndianMobile(patch.ownerMobile) || undefined;
    }
    if (patch.ownerEmail !== undefined) {
      updatePayload.normalizedOwnerEmail = normalizeEmail(patch.ownerEmail);
    }
    if (patch.availableFrom !== undefined) {
      updatePayload.availableFrom = patch.availableFrom || null;
    }
    if (patch.agreementExpiry !== undefined) {
      updatePayload.agreementExpiry = patch.agreementExpiry || null;
    }
    if (patch.lastContactAt !== undefined) {
      updatePayload.lastContactAt = patch.lastContactAt || null;
    }

    if (patch.assignedBroker !== undefined) {
      if (patch.assignedBroker === '') {
        updatePayload.assignedBroker = null;
        updatePayload.assignedBrokerName = null;
      } else {
        updatePayload.assignedBroker = patch.assignedBroker;
        updatePayload.assignedBrokerName = teamMap.get(patch.assignedBroker)?.name || patch.assignedBroker;
      }
    }

    if (patch.readyForMatching === true && !existing.readyForMatching) {
      updatePayload.readyForMatchingAt = new Date().toISOString();
    }

    if (patch.nextFollowUpAt !== undefined) {
      updatePayload.nextFollowUpAt = patch.nextFollowUpAt || null;
    }

    if (patch.followUpCompleted) {
      updatePayload.followUpCompletedAt = new Date().toISOString();
      updatePayload.nextFollowUpAt = null;
    }

    if (patch.status === 'VERIFIED' && existing.status !== 'VERIFIED') {
      // tracked via activity below
    }

    const record = await updateSupplyRecord(db, id, updatePayload);
    if (!record) {
      return NextResponse.json({ error: 'Unable to update record.' }, { status: 500 });
    }

    if (patch.status && patch.status !== existing.status) {
      await createSupplyActivity(db, {
        supplyId: id,
        type: 'STATUS_CHANGED',
        message: `Status changed to ${SUPPLY_STATUS_LABELS[patch.status]}`,
        meta: { from: existing.status, to: patch.status },
        actorId: auth.admin.id,
        actorEmail: auth.admin.email,
        actorName: auth.admin.name,
      });
    }

    if (patch.status === 'VERIFIED' && existing.status !== 'VERIFIED') {
      await createSupplyActivity(db, {
        supplyId: id,
        type: 'VERIFIED',
        message: 'Listing marked verified',
        actorId: auth.admin.id,
        actorEmail: auth.admin.email,
        actorName: auth.admin.name,
      });
    }

    if (patch.assignedBroker !== undefined && patch.assignedBroker !== (existing.assignedBroker || '')) {
      await createSupplyActivity(db, {
        supplyId: id,
        type: 'ASSIGNED',
        message: patch.assignedBroker
          ? `Assigned to ${updatePayload.assignedBrokerName || patch.assignedBroker}`
          : 'Assignment cleared',
        actorId: auth.admin.id,
        actorEmail: auth.admin.email,
        actorName: auth.admin.name,
      });
    }

    if (patch.expectedRent !== undefined && patch.expectedRent !== existing.expectedRent) {
      await createSupplyActivity(db, {
        supplyId: id,
        type: 'RENT_UPDATED',
        message: `Expected rent updated to ${patch.expectedRent || '—'}`,
        actorId: auth.admin.id,
        actorEmail: auth.admin.email,
        actorName: auth.admin.name,
      });
    }

    if (patch.expectedSalePrice !== undefined && patch.expectedSalePrice !== existing.expectedSalePrice) {
      await createSupplyActivity(db, {
        supplyId: id,
        type: 'PRICE_CHANGED',
        message: `Expected sale price updated to ${patch.expectedSalePrice || '—'}`,
        actorId: auth.admin.id,
        actorEmail: auth.admin.email,
        actorName: auth.admin.name,
      });
    }

    if (patch.agreementExpiry !== undefined && patch.agreementExpiry !== (existing.agreementExpiry || '')) {
      await createSupplyActivity(db, {
        supplyId: id,
        type: 'AGREEMENT_UPDATED',
        message: 'Agreement expiry updated',
        actorId: auth.admin.id,
        actorEmail: auth.admin.email,
        actorName: auth.admin.name,
      });
    }

    if (patch.availabilityStatus !== undefined && patch.availabilityStatus !== existing.availabilityStatus) {
      await createSupplyActivity(db, {
        supplyId: id,
        type: 'AVAILABILITY_CHANGED',
        message: `Availability updated to ${patch.availabilityStatus || '—'}`,
        actorId: auth.admin.id,
        actorEmail: auth.admin.email,
        actorName: auth.admin.name,
      });
    }

    if (patch.internalNotes !== undefined && patch.internalNotes !== existing.internalNotes) {
      await createSupplyActivity(db, {
        supplyId: id,
        type: 'NOTE_ADDED',
        message: 'Internal note updated',
        actorId: auth.admin.id,
        actorEmail: auth.admin.email,
        actorName: auth.admin.name,
      });
    }

    if (patch.readyForMatching === true && !existing.readyForMatching) {
      await createSupplyActivity(db, {
        supplyId: id,
        type: 'READY_FOR_MATCHING',
        message: 'Listing marked ready for matching',
        actorId: auth.admin.id,
        actorEmail: auth.admin.email,
        actorName: auth.admin.name,
      });
    }

    if (patch.nextFollowUpAt) {
      await createSupplyActivity(db, {
        supplyId: id,
        type: 'FOLLOW_UP_SCHEDULED',
        message: `Follow-up scheduled for ${new Date(patch.nextFollowUpAt).toLocaleString('en-IN')}`,
        meta: { nextFollowUpAt: patch.nextFollowUpAt },
        actorId: auth.admin.id,
        actorEmail: auth.admin.email,
        actorName: auth.admin.name,
      });
    }

    if (patch.followUpCompleted) {
      await createSupplyActivity(db, {
        supplyId: id,
        type: 'FOLLOW_UP_COMPLETED',
        message: 'Follow-up marked completed',
        actorId: auth.admin.id,
        actorEmail: auth.admin.email,
        actorName: auth.admin.name,
      });
    }

    await logOpsActivity({
      action: 'update_supply_record',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_supply_record',
      resourceId: id,
      details: { fields: Object.keys(patch) },
      request,
    });

    const activities = await import('@/lib/ops/supply/activity-store').then((m) =>
      m.listSupplyActivities(db, id),
    );

    return NextResponse.json({ record, activities });
  } catch (error) {
    console.error('[ops-supply] patch_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to update supply record.' }, { status: 500 });
  }
}
