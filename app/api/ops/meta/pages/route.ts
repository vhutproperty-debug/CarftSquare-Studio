import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { getMetaAdsPageId } from '@/lib/meta-ads/config';
import { metaAdsErrorResponse } from '@/lib/meta-ads/http';
import { listAccessiblePages } from '@/lib/meta-ads/pages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  try {
    const pages = await listAccessiblePages();
    return NextResponse.json({
      configuredPageId: getMetaAdsPageId(),
      pages,
    });
  } catch (error) {
    return metaAdsErrorResponse(error);
  }
}
