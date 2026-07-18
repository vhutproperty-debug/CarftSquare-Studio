import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchViewAccess } from '@/lib/research/auth';
import { listConnectorStatuses } from '@/lib/research/browser-gateway/gateway';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const workspaceId =
    new URL(request.url).searchParams.get('workspaceId') || DEFAULT_RESEARCH_WORKSPACE.id;

  try {
    const data = await listConnectorStatuses(workspaceId);
    return NextResponse.json({ ok: true, workspaceId, ...data });
  } catch (error) {
    console.error('[research] connector_status_failed', error);
    return NextResponse.json({ error: 'Failed to load connector status.' }, { status: 500 });
  }
}
