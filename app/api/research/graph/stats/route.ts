import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchViewAccess } from '@/lib/research/auth';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import { getKnowledgeDashboardStats } from '@/lib/research/graph/query';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId') || DEFAULT_RESEARCH_WORKSPACE.id;

  try {
    const stats = await getKnowledgeDashboardStats(workspaceId);
    return NextResponse.json({ ok: true, stats });
  } catch (error) {
    console.error('[research] kg_stats_failed', error);
    return NextResponse.json({ error: 'Failed to load knowledge graph stats.' }, { status: 500 });
  }
}
