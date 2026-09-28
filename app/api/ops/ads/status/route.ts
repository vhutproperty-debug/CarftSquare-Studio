import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { getMetaAdsReadiness } from '@/lib/meta-ads/readiness';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const readiness = await getMetaAdsReadiness();
    return NextResponse.json({ ok: true, readiness });
  } catch (error) {
    console.error('[ops-ads] status_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load Meta Ads status.' }, { status: 500 });
  }
}
