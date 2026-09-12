import { waitUntil } from '@vercel/functions';
import { NextResponse } from 'next/server';
import { processInteraktWebhookEvent } from '@/lib/interakt/process-event';
import { verifyInteraktSignature } from '@/lib/interakt/signature';
import type { InteraktProviderWebhookBody } from '@/lib/interakt/types';
import {
  getInteraktDatabase,
  insertWebhookEvent,
} from '@/lib/interakt/webhook-store';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Interakt inbound webhook.
 * Auth: Interakt-Signature = sha256= + hex(HMAC-SHA256(secret, rawBody))
 * Docs: https://www.interakt.shop/resource-center/interakts-webhooks/
 *
 * Ack quickly; CRM association runs via waitUntil after persist.
 */
export async function POST(request: Request) {
  const secret = process.env.INTERAKT_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error('[interakt] webhook_misconfigured_missing_secret');
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 503 });
  }

  if (!process.env.INTERAKT_BUSINESS_WA_NUMBER?.trim()) {
    console.error('[interakt] webhook_misconfigured_missing_business_wa');
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('interakt-signature')
    || request.headers.get('Interakt-Signature');

  if (!verifyInteraktSignature(secret, rawBody, signature)) {
    console.warn('[interakt] webhook_auth_failed');
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
  }

  let rawPayload: InteraktProviderWebhookBody;
  try {
    rawPayload = JSON.parse(rawBody) as InteraktProviderWebhookBody;
  } catch {
    console.warn('[interakt] webhook_invalid_json');
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  try {
    const db = await getInteraktDatabase();
    const inserted = await insertWebhookEvent(db, {
      rawBody,
      rawPayload,
      signatureValid: true,
    });

    if (inserted.duplicate) {
      console.info(
        '[interakt] webhook_duplicate',
        JSON.stringify({
          eventId: inserted.event.id,
          eventType: inserted.event.eventType,
          processingStatus: inserted.event.processingStatus,
        }),
      );

      // Re-drive processing only if the prior attempt never finished.
      if (
        inserted.event.processingStatus === 'accepted'
        || inserted.event.processingStatus === 'failed'
      ) {
        waitUntil(
          processInteraktWebhookEvent(db, inserted.event.id).catch((error) => {
            console.error(
              '[interakt] async_process_failed',
              error instanceof Error ? error.message : error,
            );
          }),
        );
      }

      return NextResponse.json({
        ok: true,
        duplicate: true,
        eventId: inserted.event.id,
      });
    }

    waitUntil(
      processInteraktWebhookEvent(db, inserted.event.id).catch((error) => {
        console.error(
          '[interakt] async_process_failed',
          error instanceof Error ? error.message : error,
        );
      }),
    );

    console.info(
      '[interakt] webhook_accepted',
      JSON.stringify({
        eventId: inserted.event.id,
        eventType: inserted.event.eventType,
        providerMessageId: inserted.event.providerMessageId,
      }),
    );

    return NextResponse.json({
      ok: true,
      duplicate: false,
      eventId: inserted.event.id,
    });
  } catch (error) {
    console.error(
      '[interakt] webhook_persist_failed',
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ error: 'Unable to accept webhook.' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed.' }, { status: 405 });
}
