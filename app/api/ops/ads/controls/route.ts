import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { isSuperAdmin, ROLES } from '@/lib/auth/rbac/roles';
import { requireOpsEditAccess } from '@/lib/ops/auth';
import { updateMetaDailyBudget, updateMetaObjectStatus } from '@/lib/meta-ads/controls';
import { metaAdsErrorResponse } from '@/lib/meta-ads/http';
import { getCampaignRecord, getMetaAdsDatabase, updateCampaignRecord } from '@/lib/meta-ads/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  campaignId: z.string().uuid(),
  action: z.enum(['pause', 'resume', 'budget']),
  dailyBudgetInr: z.number().int().min(100).max(5000).optional(),
});

export async function POST(request: Request) {
  const auth = await requireOpsEditAccess(request);
  if (!auth.ok) return authResultToResponse(auth);
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const adminRole = auth.admin.role === ROLES.ADMIN || isSuperAdmin(auth.admin);
  try {
    const db = await getMetaAdsDatabase();
    const campaign = await getCampaignRecord(db, parsed.data.campaignId);
    if (!campaign) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
    const objectId = campaign.metaAdSetId || campaign.metaCampaignId;
    if (!objectId) return NextResponse.json({ error: 'Campaign has not been published.' }, { status: 409 });

    if (parsed.data.action === 'budget') {
      const dailyBudgetInr = parsed.data.dailyBudgetInr || campaign.dailyBudgetInr;
      await updateMetaDailyBudget({ objectId, dailyBudgetInr });
      const updated = await updateCampaignRecord(db, campaign.id, { dailyBudgetInr });
      return NextResponse.json({ ok: true, campaign: updated });
    }

    const status = parsed.data.action === 'resume' ? 'ACTIVE' : 'PAUSED';
    await updateMetaObjectStatus({ objectId, status, allowActive: adminRole });
    const updated = await updateCampaignRecord(db, campaign.id, {
      metaStatus: status,
      status: status === 'PAUSED' ? 'paused_on_meta' : campaign.status,
    });
    return NextResponse.json({ ok: true, campaign: updated, metaStatus: status });
  } catch (error) {
    return metaAdsErrorResponse(error);
  }
}
