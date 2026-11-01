import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsEditAccess } from '@/lib/ops/auth';
import { runOpsMaintenance } from '@/lib/ops/maintenance';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Daily Vercel cron (Hobby) plus optional external scheduler.
 * Also drains due follow-ups, enrichment retries, template sync, and insights.
 */
async function authorizeTick(request: Request): Promise<Response | null> {
  const cronSecret = process.env.OPS_FOLLOWUPS_CRON_SECRET?.trim();
  const headerSecret = request.headers.get('x-ops-followups-secret');
  const authHeader = request.headers.get('authorization');
  const vercelCronSecret = process.env.CRON_SECRET?.trim();
  const authorizedByCron = Boolean(
    (cronSecret && headerSecret && headerSecret === cronSecret)
    || (vercelCronSecret && authHeader === `Bearer ${vercelCronSecret}`),
  );

  if (authorizedByCron) return null;

  const auth = await requireOpsEditAccess(request);
  return authResultToResponse(auth);
}

function runTick(limit = 10) {
  return runOpsMaintenance({
    limit,
    syncTemplates: true,
    syncInsights: true,
  });
}

export async function GET(request: Request) {
  const denied = await authorizeTick(request);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const result = await runTick(Number(searchParams.get('limit') || 10));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[ops-followups] tick_failed', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Follow-up tick failed.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const denied = await authorizeTick(request);
  if (denied) return denied;

  try {
    const body = await request.json().catch(() => ({}));
    const result = await runTick(Number(body.limit || 10));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[ops-followups] tick_failed', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Follow-up tick failed.' },
      { status: 500 },
    );
  }
}
