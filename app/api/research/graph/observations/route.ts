import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchViewAccess } from '@/lib/research/auth';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import { ensureKnowledgeGraphIndexes } from '@/lib/research/graph/indexes';
import type { KgObservation } from '@/lib/research/graph/types';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId') || DEFAULT_RESEARCH_WORKSPACE.id;
  const propertyId = searchParams.get('propertyId') || undefined;
  const limit = Math.min(200, Number(searchParams.get('limit') || 50));

  try {
    const db = await getResearchDatabase();
    await ensureResearchIndexes(db);
    await ensureKnowledgeGraphIndexes(db);
    const filter: Record<string, unknown> = { workspaceId };
    if (propertyId) filter.propertyId = propertyId;
    const observations = await db
      .collection<KgObservation>(RESEARCH_COLLECTIONS.kgObservations)
      .find(filter)
      .sort({ observedAt: -1 })
      .limit(limit)
      .toArray();
    return NextResponse.json({ ok: true, observations });
  } catch (error) {
    console.error('[research] kg_observations_failed', error);
    return NextResponse.json({ error: 'Failed to load observations.' }, { status: 500 });
  }
}
