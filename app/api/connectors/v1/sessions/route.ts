import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchEditAccess, requireResearchViewAccess } from '@/lib/research/auth';
import {
  connectorApiErrorResponse,
  resolveWorkspaceId,
  workspaceIdFromQuery,
} from '@/lib/research/connector-api/http';
import {
  createConnectorSession,
  listConnectorSessions,
} from '@/lib/research/connector-api/service';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Connector API v1 — list connect sessions.
 * Query: workspaceId?, provider?, active=1 (in-flight only).
 */
export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const url = new URL(request.url);
    const workspaceId = workspaceIdFromQuery(request);
    const provider = url.searchParams.get('provider') || undefined;
    const activeOnly = ['1', 'true'].includes(url.searchParams.get('active') || '');
    const sessions = await listConnectorSessions(workspaceId, { provider, activeOnly });
    return NextResponse.json({ ok: true, workspaceId, sessions });
  } catch (error) {
    return connectorApiErrorResponse(error, 'Failed to list connect sessions.');
  }
}

/**
 * Connector API v1 — start a new authenticated connect session for a provider.
 * Body: { provider, workspaceId? }.
 */
export async function POST(request: Request) {
  const auth = await requireResearchEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!auth.ok) return denied!;

  try {
    const body = await request.json().catch(() => ({}));
    const workspaceId = resolveWorkspaceId(body.workspaceId);
    const provider = String(body.provider || '').trim();
    if (!provider) {
      return NextResponse.json({ error: 'provider is required.' }, { status: 400 });
    }
    const session = await createConnectorSession({
      workspaceId,
      provider,
      actorId: auth.admin.id,
    });
    return NextResponse.json({
      ok: true,
      session,
      message:
        'Connect session queued. Poll GET /api/connectors/v1/sessions/{id} and open liveViewUrl to complete login.',
    });
  } catch (error) {
    return connectorApiErrorResponse(error, 'Failed to start connect session.');
  }
}
