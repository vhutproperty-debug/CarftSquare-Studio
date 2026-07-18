import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsEditAccess } from '@/lib/ops/auth';
import { brokerReviewActionSchema } from '@/lib/ops/brokers/schemas';
import { resolveReviewItem } from '@/lib/ops/brokers/review-actions';
import { publicOpsError } from '@/lib/ops/brokers/safe-error';
import { getDatabase } from '@/lib/ops/brokers/store';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireOpsEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!auth.ok) return denied!;

  const body = await request.json().catch(() => null);
  const parsed = brokerReviewActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const db = await getDatabase();
    const item = await resolveReviewItem(db, {
      reviewId: params.id,
      action: parsed.data.action,
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
    });

    await logOpsActivity({
      action: 'broker_review_resolved',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_broker_review_queue',
      resourceId: item.id,
      details: {
        action: parsed.data.action,
        status: item.status,
        resolutionInventoryId: item.resolutionInventoryId,
        // Avoid logging phones / full proposed payloads
        reasons: item.reasons,
      },
      request,
    });

    return NextResponse.json({ item });
  } catch (error) {
    console.error('[ops-brokers] review_resolve_failed', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: publicOpsError(error, 'Unable to resolve review item.') },
      { status: 500 },
    );
  }
}
