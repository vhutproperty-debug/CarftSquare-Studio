import { NextResponse } from 'next/server';
import { getMetaPixelIdServer, validateMetaCapiConfig } from '@/lib/meta-capi/config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Read-only Meta CAPI configuration status for ops verification.
 * Never exposes secrets.
 */
export async function GET() {
  const config = validateMetaCapiConfig();
  const pixelId = getMetaPixelIdServer();

  return NextResponse.json({
    ok: true,
    capi: {
      enabled: config.enabled,
      pixelId: pixelId ? `${pixelId.slice(0, 4)}…${pixelId.slice(-4)}` : null,
      pixelIdConfigured: config.pixelId,
      accessTokenConfigured: config.accessToken,
      testEventCodeConfigured: config.testEventCode,
      missing: config.missing,
    },
    deduplication: 'Browser Pixel + CAPI share event_id via trackLeadFromSource()',
    leadOnly: true,
  });
}
