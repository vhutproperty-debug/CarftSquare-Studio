import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchViewAccess } from '@/lib/research/auth';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import { listJobs } from '@/lib/research/monitoring/job-queue';
import type { WatchJobStatus } from '@/lib/research/monitoring/types';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId') || DEFAULT_RESEARCH_WORKSPACE.id;
  const status = searchParams.get('status') as WatchJobStatus | null;
  const jobs = await listJobs(workspaceId, {
    status: status || undefined,
    limit: Number(searchParams.get('limit') || 50),
  });
  return NextResponse.json({ ok: true, jobs });
}
