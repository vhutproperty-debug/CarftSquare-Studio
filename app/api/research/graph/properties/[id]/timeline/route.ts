import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchViewAccess } from '@/lib/research/auth';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import { getPropertyById } from '@/lib/research/graph/entity-store';
import { getPropertyTimeline } from '@/lib/research/graph/query';

export const runtime = 'nodejs';
type Ctx = { params: { id: string } };

export async function GET(request: Request, { params }: Ctx) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  const workspaceId = new URL(request.url).searchParams.get('workspaceId') || DEFAULT_RESEARCH_WORKSPACE.id;
  const property = await getPropertyById(params.id);
  if (!property || property.workspaceId !== workspaceId) {
    return NextResponse.json({ error: 'Property not found.' }, { status: 404 });
  }
  const timeline = await getPropertyTimeline(workspaceId, property.id);
  return NextResponse.json({ ok: true, timeline });
}
