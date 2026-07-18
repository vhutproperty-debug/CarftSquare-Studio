import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchEditAccess, requireResearchViewAccess } from '@/lib/research/auth';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import { understandResearchIntent } from '@/lib/research/ai/intent';
import { createWatch, listWatches } from '@/lib/research/monitoring/watch-store';
import type { WatchFrequency, WatchPriority, WatchScope } from '@/lib/research/monitoring/types';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId') || DEFAULT_RESEARCH_WORKSPACE.id;
  const watches = await listWatches(workspaceId);
  return NextResponse.json({ ok: true, watches });
}

export async function POST(request: Request) {
  const auth = await requireResearchEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!auth.ok) return denied!;

  try {
    const body = await request.json();
    const workspaceId =
      typeof body.workspaceId === 'string' && body.workspaceId.trim()
        ? body.workspaceId.trim()
        : DEFAULT_RESEARCH_WORKSPACE.id;
    const name = String(body.name || body.naturalLanguage || 'Untitled watch').trim();
    const naturalLanguage =
      typeof body.naturalLanguage === 'string' ? body.naturalLanguage.trim() : undefined;
    const scope = (body.scope || 'custom_query') as WatchScope;
    const frequency = (body.frequency || 'daily') as WatchFrequency;
    const priority = (body.priority || 'normal') as WatchPriority;

    let filters = body.filters && typeof body.filters === 'object' ? body.filters : undefined;
    if (!filters && naturalLanguage) {
      const intent = understandResearchIntent(naturalLanguage);
      filters = { city: 'Mumbai', ...intent.criteriaDelta };
    }

    const watch = await createWatch({
      workspaceId,
      createdBy: auth.admin.id,
      name,
      scope,
      targetId: typeof body.targetId === 'string' ? body.targetId : undefined,
      targetLabel: typeof body.targetLabel === 'string' ? body.targetLabel : undefined,
      savedSearchId: typeof body.savedSearchId === 'string' ? body.savedSearchId : undefined,
      landmark: typeof body.landmark === 'string' ? body.landmark : undefined,
      polygon: body.polygon && typeof body.polygon === 'object' ? body.polygon : undefined,
      filters,
      naturalLanguage: naturalLanguage || name,
      searchStrategy:
        body.searchStrategy && typeof body.searchStrategy === 'object'
          ? body.searchStrategy
          : undefined,
      frequency,
      priority,
      enabled: body.enabled !== false,
    });

    return NextResponse.json({ ok: true, watch });
  } catch (error) {
    console.error('[research] watch_create_failed', error);
    return NextResponse.json({ error: 'Failed to create watch.' }, { status: 500 });
  }
}
