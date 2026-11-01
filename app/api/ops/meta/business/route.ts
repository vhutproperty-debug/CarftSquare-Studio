import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { readBusinessAssets } from '@/lib/meta-ads/business-assets';
import { metaAdsErrorResponse } from '@/lib/meta-ads/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  try {
    const assets = await readBusinessAssets();
    return NextResponse.json(assets);
  } catch (error) {
    return metaAdsErrorResponse(error);
  }
}
