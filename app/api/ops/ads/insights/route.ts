import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { getMetaAdsAdAccountId } from '@/lib/meta-ads/config';
import { metaAdsErrorResponse } from '@/lib/meta-ads/http';
import { readCampaignInsights } from '@/lib/meta-ads/insights';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  const url = new URL(request.url);
  const since = url.searchParams.get('since') || undefined;
  const until = url.searchParams.get('until') || undefined;
  const preset = url.searchParams.get('preset') || undefined;
  try {
    const campaigns = await readCampaignInsights({ preset, since, until });
    return NextResponse.json({
      adAccountId: getMetaAdsAdAccountId(),
      preset: since && until ? null : (preset || 'last_7d'),
      since: since || null,
      until: until || null,
      campaigns,
    });
  } catch (error) {
    return metaAdsErrorResponse(error);
  }
}
