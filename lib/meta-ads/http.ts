import { NextResponse } from 'next/server';
import { MetaAdsApiError } from '@/lib/meta-ads/client';
import { META_PERMISSION_PENDING_MESSAGE } from '@/lib/meta-ads/messages';

export function metaAdsErrorResponse(error: unknown) {
  if (error instanceof MetaAdsApiError && error.permissionPending) {
    return NextResponse.json(
      { error: META_PERMISSION_PENDING_MESSAGE, permissionPending: true },
      { status: 403 },
    );
  }
  const status = Number((error as { status?: number }).status);
  const http = status >= 400 && status < 600 ? status : (error instanceof MetaAdsApiError ? 502 : 500);
  const message = error instanceof Error && error.message ? error.message : 'Meta request failed.';
  return NextResponse.json({ error: message }, { status: http });
}
