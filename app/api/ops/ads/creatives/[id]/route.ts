import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsEditAccess } from '@/lib/ops/auth';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { getCreative, getMetaAdsDatabase, updateCreativeStatus } from '@/lib/meta-ads/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const patchSchema = z.object({
  action: z.enum(['approve', 'reject']),
  rejectReason: z.string().trim().max(300).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const auth = await requireOpsEditAccess(request);
  if (!auth.ok) return authResultToResponse(auth);

  try {
    const params = await Promise.resolve(context.params);
    const id = params.id;
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const db = await getMetaAdsDatabase();
    const existing = await getCreative(db, id);
    if (!existing) return NextResponse.json({ error: 'Creative not found.' }, { status: 404 });

    const now = new Date().toISOString();
    const creative =
      parsed.data.action === 'approve'
        ? await updateCreativeStatus(db, id, 'approved', {
            approvedBy: auth.admin.id,
            approvedAt: now,
            rejectReason: undefined,
          })
        : await updateCreativeStatus(db, id, 'rejected', {
            rejectReason: parsed.data.rejectReason || 'Rejected',
            approvedBy: undefined,
            approvedAt: undefined,
          });

    await logOpsActivity({
      action: `meta_ads_creative_${parsed.data.action}`,
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_meta_ad_creatives',
      resourceId: id,
      request,
    });

    return NextResponse.json({ creative });
  } catch (error) {
    console.error('[ops-ads] creative_patch_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to update creative.' }, { status: 500 });
  }
}
