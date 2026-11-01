import { NextResponse } from 'next/server';
import { authorizeCron } from '@/lib/ops/cron-auth';
import { listTemplates } from '@/lib/whatsapp-cloud/client';
import { upsertSyncedTemplates } from '@/lib/whatsapp-cloud/templates';
import { getWaDatabase } from '@/lib/whatsapp-cloud/webhook-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const denied = await authorizeCron(request);
  if (denied) return denied;
  try {
    const templates = await listTemplates();
    const db = await getWaDatabase();
    const synced = await upsertSyncedTemplates(db, templates);
    return NextResponse.json({ ok: true, synced });
  } catch (error) {
    console.error('[whatsapp] template_sync_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unable to sync templates.',
    }, { status: 500 });
  }
}
