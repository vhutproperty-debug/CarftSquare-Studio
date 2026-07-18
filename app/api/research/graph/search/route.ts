import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchViewAccess } from '@/lib/research/auth';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import {
  advancedKnowledgeSearch,
  parseAdvancedKnowledgeQuery,
} from '@/lib/research/graph/advanced-search';
import type { KgAdvancedSearchQuery } from '@/lib/research/graph/types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const body = await request.json();
    const workspaceId =
      typeof body.workspaceId === 'string' && body.workspaceId.trim()
        ? body.workspaceId.trim()
        : DEFAULT_RESEARCH_WORKSPACE.id;

    let query: KgAdvancedSearchQuery | null = null;
    if (typeof body.q === 'string' && body.q.trim()) {
      query = parseAdvancedKnowledgeQuery(body.q, workspaceId);
    }
    if (!query && body.filters && typeof body.filters === 'object') {
      query = { workspaceId, ...body.filters };
    }
    if (!query) {
      return NextResponse.json(
        { error: 'Provide q (natural language) or filters for advanced knowledge search.' },
        { status: 400 },
      );
    }

    const properties = await advancedKnowledgeSearch(query);
    return NextResponse.json({ ok: true, query, properties });
  } catch (error) {
    console.error('[research] kg_search_failed', error);
    return NextResponse.json({ error: 'Advanced search failed.' }, { status: 500 });
  }
}
