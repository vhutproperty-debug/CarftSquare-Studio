import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchViewAccess } from '@/lib/research/auth';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import {
  computeWorkspaceTrends,
  listTrends,
} from '@/lib/research/monitoring/trend-engine';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId') || DEFAULT_RESEARCH_WORKSPACE.id;
  const refresh = searchParams.get('refresh') === 'true';
  const trends = refresh
    ? await computeWorkspaceTrends(workspaceId)
    : await listTrends(workspaceId, Number(searchParams.get('limit') || 50));
  return NextResponse.json({ ok: true, trends });
}
