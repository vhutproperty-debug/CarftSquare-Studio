import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchViewAccess } from '@/lib/research/auth';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import { findProjectByName } from '@/lib/research/graph/query';
import { ensureKnowledgeGraphIndexes } from '@/lib/research/graph/indexes';
import type { KgProject } from '@/lib/research/graph/types';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId') || DEFAULT_RESEARCH_WORKSPACE.id;
  const name = searchParams.get('name')?.trim();

  try {
    if (name) {
      const project = await findProjectByName(workspaceId, name);
      return NextResponse.json({ ok: true, project });
    }
    const db = await getResearchDatabase();
    await ensureResearchIndexes(db);
    await ensureKnowledgeGraphIndexes(db);
    const projects = await db
      .collection<KgProject>(RESEARCH_COLLECTIONS.kgProjects)
      .find({ workspaceId })
      .sort({ lastSeenAt: -1 })
      .limit(50)
      .toArray();
    return NextResponse.json({ ok: true, projects });
  } catch (error) {
    console.error('[research] kg_projects_failed', error);
    return NextResponse.json({ error: 'Project lookup failed.' }, { status: 500 });
  }
}
