import { NextResponse } from 'next/server';
import { authorizeWhatsAppReplies } from '@/lib/ops/whatsapp/replies-auth';
import { listWhatsAppReplies, parseRepliesSince } from '@/lib/whatsapp-cloud/replies';
import { getWaDatabase } from '@/lib/whatsapp-cloud/webhook-store';

export async function GET(request: Request) {
  const denied = authorizeWhatsAppReplies(request);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const since = parseRepliesSince(searchParams.get('since'));
  if ('error' in since) {
    return NextResponse.json({ error: since.error }, { status: 400 });
  }

  try {
    const db = await getWaDatabase();
    const replies = await listWhatsAppReplies(db, {
      project: searchParams.get('project')?.trim() || undefined,
      since: since.since,
      limit: Number(searchParams.get('limit') || 200),
    });
    return NextResponse.json({ replies });
  } catch (error) {
    console.error('[ops-whatsapp] replies_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load WhatsApp replies.' }, { status: 500 });
  }
}
