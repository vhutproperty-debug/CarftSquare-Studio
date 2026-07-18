import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchViewAccess } from '@/lib/research/auth';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import { getGraphRelationships } from '@/lib/research/graph/query';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId') || DEFAULT_RESEARCH_WORKSPACE.id;
  const entityId = searchParams.get('entityId')?.trim();
  if (!entityId) {
    return NextResponse.json({ error: 'entityId is required.' }, { status: 400 });
  }

  try {
    const relationships = await getGraphRelationships(workspaceId, entityId);
    return NextResponse.json({ ok: true, relationships });
  } catch (error) {
    console.error('[research] kg_relationships_failed', error);
    return NextResponse.json({ error: 'Failed to load relationships.' }, { status: 500 });
  }
}
