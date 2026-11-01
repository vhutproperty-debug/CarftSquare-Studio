import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { getWhatsAppVerifyToken } from '@/lib/whatsapp-cloud/config';
import { verifyXHubSignature256 } from '@/lib/whatsapp-cloud/signature';
import { acceptCloudWebhook, processCloudWebhookEvent } from '@/lib/whatsapp-cloud/process-event';
import { getWaDatabase } from '@/lib/whatsapp-cloud/webhook-store';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  const expected = getWhatsAppVerifyToken();
  if (mode === 'subscribe' && expected && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'Verification failed.' }, { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256');
  if (!verifyXHubSignature256(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  try {
    const db = await getWaDatabase();
    const accepted = await acceptCloudWebhook(db, rawBody, body);
    waitUntil(
      Promise.all(accepted.eventIds.map((id) => processCloudWebhookEvent(db, id))).catch((error) => {
        console.error('[whatsapp] async_process_failed', error instanceof Error ? error.message : error);
      }),
    );
    return NextResponse.json({ ok: true, accepted: accepted.accepted, duplicate: accepted.duplicate });
  } catch (error) {
    console.error('[whatsapp] webhook_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to accept webhook.' }, { status: 500 });
  }
}
