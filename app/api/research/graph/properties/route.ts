import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchViewAccess } from '@/lib/research/auth';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import { ensureKnowledgeGraphIndexes } from '@/lib/research/graph/indexes';
import type { KgProperty } from '@/lib/research/graph/types';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId') || DEFAULT_RESEARCH_WORKSPACE.id;
  const q = searchParams.get('q')?.trim();
  const limit = Math.min(100, Number(searchParams.get('limit') || 40));

  try {
    const db = await getResearchDatabase();
    await ensureResearchIndexes(db);
    await ensureKnowledgeGraphIndexes(db);
    const filter: Record<string, unknown> = { workspaceId };
    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { projectName: { $regex: q, $options: 'i' } },
        { unit: { $regex: q, $options: 'i' } },
      ];
    }
    const properties = await db
      .collection<KgProperty>(RESEARCH_COLLECTIONS.kgProperties)
      .find(filter)
      .sort({ lastSeenAt: -1 })
      .limit(limit)
      .toArray();
    return NextResponse.json({ ok: true, properties });
  } catch (error) {
    console.error('[research] kg_properties_failed', error);
    return NextResponse.json({ error: 'Property lookup failed.' }, { status: 500 });
  }
}
