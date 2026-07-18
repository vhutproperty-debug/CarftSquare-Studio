import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchViewAccess } from '@/lib/research/auth';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import { getPropertyById } from '@/lib/research/graph/entity-store';
import {
  getGraphRelationships,
  getPropertyChanges,
  getPropertyObservations,
  getPropertyPriceHistory,
  getPropertyTimeline,
} from '@/lib/research/graph/query';

export const runtime = 'nodejs';

type Ctx = { params: { id: string } };

export async function GET(request: Request, { params }: Ctx) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId') || DEFAULT_RESEARCH_WORKSPACE.id;

  try {
    const property = await getPropertyById(params.id);
    if (!property || property.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Property not found.' }, { status: 404 });
    }
    const [timeline, observations, priceHistory, changes, relationships] = await Promise.all([
      getPropertyTimeline(workspaceId, property.id),
      getPropertyObservations(workspaceId, property.id),
      getPropertyPriceHistory(workspaceId, property.id),
      getPropertyChanges(workspaceId, property.id),
      getGraphRelationships(workspaceId, property.id),
    ]);
    return NextResponse.json({
      ok: true,
      property,
      timeline,
      observations,
      priceHistory,
      changes,
      relationships,
    });
  } catch (error) {
    console.error('[research] kg_property_get_failed', error);
    return NextResponse.json({ error: 'Failed to load property.' }, { status: 500 });
  }
}
