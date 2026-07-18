import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchViewAccess } from '@/lib/research/auth';
import { fetchBrowserWorkerLogs } from '@/lib/research/browser-gateway/worker-client';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const limit = Math.min(Number(new URL(request.url).searchParams.get('limit') || 80), 200);
  const logs = await fetchBrowserWorkerLogs(limit);
  return NextResponse.json({ ok: true, logs });
}
