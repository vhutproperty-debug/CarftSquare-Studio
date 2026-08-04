import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchEditAccess } from '@/lib/research/auth';
import {
  connectorApiErrorResponse,
  resolveWorkspaceId,
} from '@/lib/research/connector-api/http';
import {
  executeConnectorSearch,
  executeConnectorSearchMany,
} from '@/lib/research/connector-api/service';
import type { ResearchPlanCriteria } from '@/lib/research/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Connector API v1 — authenticated search.
 *
 * Single provider:
 *   { provider, criteria, workspaceId? }
 * Multi provider (parallel, same Research engine):
 *   { providers: string[], criteria, workspaceId? }
 *
 * Uses the same validate → search pipeline as Research (freshness-aware
 * validation, worker-executed Chromium search, encrypted stored session).
 */
export async function POST(request: Request) {
  const auth = await requireResearchEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const body = await request.json().catch(() => ({}));
    const workspaceId = resolveWorkspaceId(body.workspaceId);
    const criteria = (body.criteria || {}) as ResearchPlanCriteria;
    if (!criteria.city && !criteria.locality && !criteria.project) {
      return NextResponse.json(
        { error: 'criteria requires at least one of: city, locality, project.' },
        { status: 400 },
      );
    }

    const providers = Array.isArray(body.providers)
      ? body.providers.map((p: unknown) => String(p || '').trim()).filter(Boolean)
      : [];
    if (providers.length) {
      const result = await executeConnectorSearchMany({
        workspaceId,
        providers,
        criteria,
      });
      return NextResponse.json({ ok: true, workspaceId, ...result });
    }

    const provider = String(body.provider || '').trim();
    if (!provider) {
      return NextResponse.json(
        { error: 'provider or providers[] is required.' },
        { status: 400 },
      );
    }

    const result = await executeConnectorSearch({ workspaceId, provider, criteria });
    return NextResponse.json({ workspaceId, ...result });
  } catch (error) {
    return connectorApiErrorResponse(error, 'Search failed.');
  }
}
