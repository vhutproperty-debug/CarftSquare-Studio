import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchViewAccess } from '@/lib/research/auth';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import type { KgChange, KgTimelineEvent } from '@/lib/research/graph/types';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';

export const runtime = 'nodejs';

/** Live change timeline for any monitored entity (property/project/broker/locality/builder/portal). */
export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId') || DEFAULT_RESEARCH_WORKSPACE.id;
  const entityType = searchParams.get('entityType');
  const entityId = searchParams.get('entityId');
  if (!entityType || !entityId) {
    return NextResponse.json(
      { error: 'entityType and entityId are required.' },
      { status: 400 },
    );
  }

  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  const limit = Math.min(Number(searchParams.get('limit') || 100), 500);

  let propertyIds: string[] = [];
  if (entityType === 'property') {
    propertyIds = [entityId];
  } else if (entityType === 'project') {
    propertyIds = (
      await db
        .collection(RESEARCH_COLLECTIONS.kgProperties)
        .find({ workspaceId, projectId: entityId })
        .project({ id: 1 })
        .limit(500)
        .toArray()
    ).map((p) => String(p.id));
  } else if (entityType === 'broker') {
    propertyIds = (
      await db
        .collection(RESEARCH_COLLECTIONS.kgProperties)
        .find({ workspaceId, brokerId: entityId })
        .project({ id: 1 })
        .limit(500)
        .toArray()
    ).map((p) => String(p.id));
  } else if (entityType === 'locality') {
    propertyIds = (
      await db
        .collection(RESEARCH_COLLECTIONS.kgProperties)
        .find({ workspaceId, localityId: entityId })
        .project({ id: 1 })
        .limit(500)
        .toArray()
    ).map((p) => String(p.id));
  } else if (entityType === 'builder') {
    const projects = await db
      .collection(RESEARCH_COLLECTIONS.kgProjects)
      .find({ workspaceId, builderId: entityId })
      .project({ id: 1 })
      .limit(200)
      .toArray();
    const projectIds = projects.map((p) => String(p.id));
    propertyIds = projectIds.length
      ? (
          await db
            .collection(RESEARCH_COLLECTIONS.kgProperties)
            .find({ workspaceId, projectId: { $in: projectIds } })
            .project({ id: 1 })
            .limit(500)
            .toArray()
        ).map((p) => String(p.id))
      : [];
  } else if (entityType === 'portal') {
    propertyIds = (
      await db
        .collection(RESEARCH_COLLECTIONS.kgProperties)
        .find({ workspaceId, portalKeys: entityId })
        .project({ id: 1 })
        .limit(500)
        .toArray()
    ).map((p) => String(p.id));
  }

  const [timeline, changes, notifications] = await Promise.all([
    propertyIds.length
      ? db
          .collection<KgTimelineEvent>(RESEARCH_COLLECTIONS.kgTimeline)
          .find({ workspaceId, propertyId: { $in: propertyIds } })
          .sort({ at: -1 })
          .limit(limit)
          .toArray()
      : Promise.resolve([] as KgTimelineEvent[]),
    propertyIds.length
      ? db
          .collection<KgChange>(RESEARCH_COLLECTIONS.kgChanges)
          .find({ workspaceId, propertyId: { $in: propertyIds } })
          .sort({ detectedAt: -1 })
          .limit(limit)
          .toArray()
      : Promise.resolve([] as KgChange[]),
    db
      .collection(RESEARCH_COLLECTIONS.notifications)
      .find({
        workspaceId,
        $or: [
          { propertyId: entityId },
          { projectId: entityId },
          { brokerId: entityId },
          { localityId: entityId },
          ...(propertyIds.length ? [{ propertyId: { $in: propertyIds } }] : []),
        ],
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray(),
  ]);

  const events = [
    ...timeline.map((t) => ({
      kind: 'timeline' as const,
      at: t.at,
      title: t.label || t.type,
      detail: t.details ? JSON.stringify(t.details) : t.type,
      evidence: t.details || {},
      propertyId: t.propertyId,
      raw: t,
    })),
    ...changes.map((c) => ({
      kind: 'change' as const,
      at: c.detectedAt,
      title: c.type,
      detail: `${c.type}${c.fromValue != null ? ` (${String(c.fromValue)} → ${String(c.toValue)})` : ''}`,
      evidence: c.evidence || {},
      propertyId: c.propertyId,
      raw: c,
    })),
    ...notifications.map((n) => ({
      kind: 'alert' as const,
      at: n.createdAt,
      title: n.title,
      detail: n.body,
      evidence: n.evidence || {},
      propertyId: n.propertyId,
      raw: n,
    })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)));

  return NextResponse.json({
    ok: true,
    entityType,
    entityId,
    propertyCount: propertyIds.length,
    events: events.slice(0, limit),
  });
}
