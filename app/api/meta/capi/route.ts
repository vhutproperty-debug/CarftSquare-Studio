import { NextResponse } from 'next/server';
import { getMetaPixelIdServer, validateMetaCapiConfig } from '@/lib/meta-capi/config';
import { metaCapiRequestSchema } from '@/lib/meta-capi/schemas';
import { sendMetaConversionEvent } from '@/lib/meta-capi/server';
import { META_CAPI_PROXY_EVENTS } from '@/lib/meta-capi/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 40;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

const recentEventIds = new Map<string, number>();
const EVENT_ID_TTL_MS = 5 * 60_000;

function getClientIp(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first && first.length <= 64) return first;
  }
  const realIp = request.headers.get('x-real-ip')?.trim();
  return realIp && realIp.length <= 64 ? realIp : undefined;
}

function allowRate(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_MAX) return false;
  bucket.count += 1;
  return true;
}

function isDuplicateEventId(eventId: string): boolean {
  const now = Date.now();
  for (const [id, expires] of recentEventIds) {
    if (expires <= now) recentEventIds.delete(id);
  }
  if (recentEventIds.has(eventId)) return true;
  recentEventIds.set(eventId, now + EVENT_ID_TTL_MS);
  return false;
}

/** Read-only config status — never returns the access token. */
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
      graphApiVersion: config.graphApiVersion,
      allowedEvents: META_CAPI_PROXY_EVENTS,
      missing: config.missing,
    },
    deduplication: 'Browser Pixel + CAPI share event_id for conversion events',
  });
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request) || 'unknown';
    if (!allowRate(ip)) {
      return NextResponse.json({ ok: false, error: 'Rate limit exceeded.' }, { status: 429 });
    }

    const body = await request.json();
    const parsed = metaCapiRequestSchema.safeParse(body);
    if (!parsed.success) {
      console.warn('[Meta CAPI] Invalid request payload:', parsed.error.flatten());
      return NextResponse.json({ ok: false, error: 'Invalid payload.' }, { status: 400 });
    }

    const data = parsed.data;

    if (isDuplicateEventId(data.eventId)) {
      return NextResponse.json({ ok: true, deduplicated: true });
    }

    console.info('[Meta CAPI] Event received:', {
      eventName: data.eventName,
      eventId: data.eventId,
      eventSourceUrl: data.eventSourceUrl,
      landingPage: data.customData?.landing_page,
      contentName: data.customData?.content_name,
      hasPhone: Boolean(data.userData?.phone),
      hasEmail: Boolean(data.userData?.email),
    });

    const result = await sendMetaConversionEvent({
      eventName: data.eventName,
      eventId: data.eventId,
      eventSourceUrl: data.eventSourceUrl,
      customData: data.customData,
      userData: data.userData,
      clientIpAddress: ip === 'unknown' ? undefined : ip,
      clientUserAgent: request.headers.get('user-agent') || undefined,
    });

    if (result.skipped) {
      console.warn('[Meta CAPI] Skipped server event:', {
        eventName: data.eventName,
        eventId: data.eventId,
        reason: result.error,
      });
      // Soft success so client never blocks UX when CAPI is unconfigured
      return NextResponse.json({ ok: false, skipped: true }, { status: 202 });
    }

    if (!result.ok) {
      console.error('[Meta CAPI] Route handler error:', {
        eventName: data.eventName,
        eventId: data.eventId,
        error: result.error || 'Meta CAPI failed',
      });
      // Still 202 — Meta failure must not surface as a hard client error
      return NextResponse.json({ ok: false, error: 'Meta CAPI failed' }, { status: 202 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 });
  }
}
