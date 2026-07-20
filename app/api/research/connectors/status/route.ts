import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchViewAccess } from '@/lib/research/auth';
import {
  listConnectorStatuses,
  liveValidateConnectorStatuses,
} from '@/lib/research/browser-gateway/gateway';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * GET connector status cards.
 * ?live=1 — run worker session validation for portals with sessions (additive).
 * Default — enriched status from session existence / expiry / stored validate results.
 */
export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const url = new URL(request.url);
  const workspaceId =
    url.searchParams.get('workspaceId') || DEFAULT_RESEARCH_WORKSPACE.id;
  const live = url.searchParams.get('live') === '1' || url.searchParams.get('live') === 'true';

  try {
    const data = live
      ? await liveValidateConnectorStatuses(workspaceId)
      : await listConnectorStatuses(workspaceId);
    return NextResponse.json({ ok: true, workspaceId, ...data });
  } catch (error) {
    console.error('[research] connector_status_failed', error);
    return NextResponse.json({ error: 'Failed to load connector status.' }, { status: 500 });
  }
}
