import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchViewAccess } from '@/lib/research/auth';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import { countJobsByStatus, listJobs } from '@/lib/research/monitoring/job-queue';
import { listDueWatches, listWatches } from '@/lib/research/monitoring/watch-store';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const workspaceId =
    new URL(request.url).searchParams.get('workspaceId') || DEFAULT_RESEARCH_WORKSPACE.id;

  const [watches, due, jobs, counts] = await Promise.all([
    listWatches(workspaceId),
    listDueWatches(50),
    listJobs(workspaceId, { limit: 30 }),
    countJobsByStatus(workspaceId),
  ]);

  return NextResponse.json({
    ok: true,
    activeWatches: watches.filter((w) => w.status === 'active').length,
    dueWatches: due.filter((w) => w.workspaceId === workspaceId).length,
    jobCounts: counts,
    recentJobs: jobs,
  });
}
