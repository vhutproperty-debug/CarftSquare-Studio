import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsEditAccess, requireOpsViewAccess } from '@/lib/ops/auth';
import { getPageLeadSubscription, subscribePageToLeadgen } from '@/lib/meta-ads/page-subscription';

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
      subscription,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unable to read page subscription.',
    }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const auth = await requireOpsEditAccess(request);
  if (!auth.ok) return authResultToResponse(auth);
  try {
    const result = await subscribePageToLeadgen();
    return NextResponse.json({
      ok: true,
      call: 'POST /{page-id}/subscribed_apps',
      permission: 'pages_manage_metadata',
      subscribedFields: ['leadgen'],
      result,
    });
  } catch (error) {
    const status = (error as { status?: number }).status || 502;
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unable to subscribe the Page to leadgen.',
    }, { status });
  }
}
