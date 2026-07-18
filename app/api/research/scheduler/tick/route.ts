import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchEditAccess } from '@/lib/research/auth';
import { runMonitorTick } from '@/lib/research/monitoring/worker';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Cron/worker entrypoint: enqueue due watches and process the priority job queue.
 * Also accepts RESEARCH_MONITOR_CRON_SECRET for headless cron without user session.
 */
export async function POST(request: Request) {
  const cronSecret = process.env.RESEARCH_MONITOR_CRON_SECRET;
  const headerSecret = request.headers.get('x-research-monitor-secret');
  const authorizedByCron = Boolean(cronSecret && headerSecret && headerSecret === cronSecret);

  if (!authorizedByCron) {
    const auth = await requireResearchEditAccess(request);
    const denied = authResultToResponse(auth);
    if (denied) return denied;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const result = await runMonitorTick({
      enqueueLimit: Number(body.enqueueLimit || 20),
      processLimit: Number(body.processLimit || 2),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[research] monitor_tick_failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Monitor tick failed.' },
      { status: 500 },
    );
  }
}
