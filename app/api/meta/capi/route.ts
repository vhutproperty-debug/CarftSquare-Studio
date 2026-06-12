import { NextResponse } from 'next/server';
import { metaCapiRequestSchema } from '@/lib/meta-capi/schemas';
import { sendMetaConversionEvent } from '@/lib/meta-capi/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getClientIp(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim();
  return request.headers.get('x-real-ip')?.trim() || undefined;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = metaCapiRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    const result = await sendMetaConversionEvent({
      eventName: data.eventName,
      eventId: data.eventId,
      eventSourceUrl: data.eventSourceUrl,
      customData: data.customData,
      userData: data.userData,
      clientIpAddress: getClientIp(request),
      clientUserAgent: request.headers.get('user-agent') || undefined,
    });

    if (result.skipped) {
      return NextResponse.json({ ok: false, skipped: true }, { status: 202 });
    }

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error || 'Meta CAPI failed' }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 });
  }
}
