import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchViewAccess } from '@/lib/research/auth';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId') || DEFAULT_RESEARCH_WORKSPACE.id;
  const limit = Math.min(Number(searchParams.get('limit') || 50), 200);
  const propertyId = searchParams.get('propertyId') || searchParams.get('entityId');

  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);

  const changeFilter: Record<string, unknown> = { workspaceId };
  const timelineFilter: Record<string, unknown> = { workspaceId };
  if (propertyId) {
    changeFilter.propertyId = propertyId;
    timelineFilter.propertyId = propertyId;
  }

  const notificationFilter: Record<string, unknown> = { workspaceId };
  if (propertyId) {
    notificationFilter.$or = [
      { propertyId },
      { projectId: propertyId },
      { brokerId: propertyId },
      { localityId: propertyId },
    ];
  }

  const [changes, timeline, notifications, jobs] = await Promise.all([
    db
      .collection(RESEARCH_COLLECTIONS.kgChanges)
      .find(changeFilter)
      .sort({ detectedAt: -1 })
      .limit(limit)
      .toArray(),
    db
      .collection(RESEARCH_COLLECTIONS.kgTimeline)
      .find(timelineFilter)
      .sort({ at: -1 })
      .limit(limit)
      .toArray(),
    db
      .collection(RESEARCH_COLLECTIONS.notifications)
      .find(notificationFilter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray(),
    db
      .collection(RESEARCH_COLLECTIONS.watchJobs)
      .find({ workspaceId })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray(),
  ]);

  return NextResponse.json({
    ok: true,
    recentChanges: changes,
    timeline,
    alerts: notifications,
    recentJobs: jobs,
  });
}
