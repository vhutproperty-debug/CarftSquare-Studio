import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchViewAccess } from '@/lib/research/auth';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import { getExplorerProjects, getExplorerTree } from '@/lib/research/graph/explorer';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId') || DEFAULT_RESEARCH_WORKSPACE.id;
  const projectId = searchParams.get('projectId') || undefined;

  try {
    if (projectId) {
      const tree = await getExplorerTree(workspaceId, projectId);
      if (!tree) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
      return NextResponse.json({ ok: true, tree });
    }
    const projects = await getExplorerProjects(workspaceId);
    return NextResponse.json({ ok: true, projects });
  } catch (error) {
    console.error('[research] kg_explorer_failed', error);
    return NextResponse.json({ error: 'Explorer failed.' }, { status: 500 });
  }
}
