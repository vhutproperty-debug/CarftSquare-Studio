import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchViewAccess } from '@/lib/research/auth';
import { listWorkerHeartbeats } from '@/lib/research/monitoring/worker-health';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const workers = await listWorkerHeartbeats();
  const now = Date.now();
  return NextResponse.json({
    ok: true,
    workers: workers.map((w) => {
      const age = now - new Date(w.lastHeartbeatAt).getTime();
      return {
        ...w,
        onlineStatus: age <= 180_000 ? 'online' : age <= 900_000 ? 'stale' : 'offline',
      };
    }),
  });
}
