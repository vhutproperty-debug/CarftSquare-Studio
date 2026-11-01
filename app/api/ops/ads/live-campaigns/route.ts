import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { isSuperAdmin, ROLES } from '@/lib/auth/rbac/roles';
import { requireOpsEditAccess, requireOpsViewAccess } from '@/lib/ops/auth';
import { listAdAccountCampaigns } from '@/lib/meta-ads/account-campaigns';
import { updateMetaObjectStatus } from '@/lib/meta-ads/controls';
import { getMetaAdsAdAccountId } from '@/lib/meta-ads/config';
import { metaAdsErrorResponse } from '@/lib/meta-ads/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  try {
    const campaigns = await listAdAccountCampaigns();
    return NextResponse.json({
      adAccountId: getMetaAdsAdAccountId(),
      campaigns,
    });
  } catch (error) {
    return metaAdsErrorResponse(error);
  }
}

const schema = z.object({
  campaignId: z.string().regex(/^\d+$/),
  action: z.enum(['pause', 'resume']),
});

export async function POST(request: Request) {
  const auth = await requireOpsEditAccess(request);
  if (!auth.ok) return authResultToResponse(auth);
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Choose a campaign and Pause or Resume.' }, { status: 400 });
  }
  const adminRole = auth.admin.role === ROLES.ADMIN || isSuperAdmin(auth.admin);
  try {
    const status = parsed.data.action === 'resume' ? 'ACTIVE' : 'PAUSED';
    await updateMetaObjectStatus({
      objectId: parsed.data.campaignId,
      status,
      allowActive: adminRole,
    });
    return NextResponse.json({ ok: true, campaignId: parsed.data.campaignId, metaStatus: status });
  } catch (error) {
    return metaAdsErrorResponse(error);
  }
}
