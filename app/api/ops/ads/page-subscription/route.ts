import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsEditAccess, requireOpsViewAccess } from '@/lib/ops/auth';
import { metaAdsErrorResponse } from '@/lib/meta-ads/http';
import { getMetaAdsPageId } from '@/lib/meta-ads/config';
import {
  getPageLeadSubscription,
  subscribePageToLeadgen,
  unsubscribePageFromLeadgen,
} from '@/lib/meta-ads/page-subscription';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  try {
    const subscription = await getPageLeadSubscription();
    return NextResponse.json({
      call: 'GET /{page-id}/subscribed_apps',
      permission: 'pages_manage_metadata',
      ...subscription,
    });
  } catch (error) {
    return metaAdsErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireOpsEditAccess(request);
  if (!auth.ok) return authResultToResponse(auth);
  try {
    const result = await subscribePageToLeadgen();
    const subscription = await getPageLeadSubscription().catch(() => null);
    return NextResponse.json({
      ok: true,
      call: 'POST /{page-id}/subscribed_apps',
      permission: 'pages_manage_metadata',
      subscribedFields: ['leadgen'],
      result,
      pageId: subscription?.pageId || getMetaAdsPageId(),
      leadgenSubscribed: subscription?.leadgenSubscribed ?? true,
      apps: subscription?.apps || [],
    });
  } catch (error) {
    return metaAdsErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const auth = await requireOpsEditAccess(request);
  if (!auth.ok) return authResultToResponse(auth);
  try {
    const result = await unsubscribePageFromLeadgen();
    const subscription = await getPageLeadSubscription().catch(() => null);
    return NextResponse.json({
      ok: true,
      call: 'DELETE /{page-id}/subscribed_apps',
      permission: 'pages_manage_metadata',
      result,
      subscription,
    });
  } catch (error) {
    return metaAdsErrorResponse(error);
  }
}
