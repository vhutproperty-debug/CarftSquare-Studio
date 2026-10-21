import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSiteUrl } from '@/lib/site';

export const runtime = 'nodejs';

function appSecret() {
  return String(process.env.META_APP_SECRET || process.env.WHATSAPP_APP_SECRET || '').trim();
}

function parseSignedRequest(signedRequest: string, secret: string): { user_id?: string } | null {
  const parts = String(signedRequest || '').split('.');
  if (parts.length !== 2) return null;
  const [encodedSig, payload] = parts;
  const sig = Buffer.from(encodedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const expected = createHmac('sha256', secret).update(payload).digest();
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
  try {
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json) as { user_id?: string };
  } catch {
    return null;
  }
}

function confirmationCode(userId?: string) {
  const suffix = randomBytes(4).toString('hex');
  const who = String(userId || 'user').replace(/\W/g, '').slice(-8) || 'user';
  return `csdel_${who}_${suffix}`;
}

/** Facebook data-deletion status check (user opens this URL). */
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get('code') || new URL(request.url).searchParams.get('id');
  if (!code) {
    return NextResponse.redirect(new URL('/data-deletion', getSiteUrl()), 302);
  }
  return NextResponse.json({
    confirmation_code: code,
    status: 'received',
    message: 'CraftSquare has received this deletion request. Email notifications@craftsquare.studio if you need an update.',
  });
}

/**
 * Meta App → Settings → Basic → Data Deletion Request Callback.
 * Facebook POSTs signed_request. Respond with confirmation_code + status URL.
 */
export async function POST(request: Request) {
  const secret = appSecret();
  if (!secret) {
    return NextResponse.json({ error: 'Data deletion callback is not configured.' }, { status: 503 });
  }

  let signedRequest = '';
  const contentType = request.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json')) {
      const body = (await request.json()) as { signed_request?: string };
      signedRequest = String(body.signed_request || '');
    } else {
      const text = await request.text();
      signedRequest = new URLSearchParams(text).get('signed_request') || '';
    }
  } catch {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 });
  }

  const parsed = parseSignedRequest(signedRequest, secret);
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid signed_request.' }, { status: 400 });
  }

  const code = confirmationCode(parsed.user_id);
  const url = `${getSiteUrl().replace(/\/$/, '')}/api/data-deletion?code=${encodeURIComponent(code)}`;
  console.info('[meta] data_deletion_received', code);
  return NextResponse.json({ url, confirmation_code: code });
}
