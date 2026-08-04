import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchEditAccess, requireResearchViewAccess } from '@/lib/research/auth';
import {
  connectorApiErrorResponse,
  workspaceIdFromQuery,
} from '@/lib/research/connector-api/http';
import {
  cancelConnectorSession,
  getConnectorSession,
} from '@/lib/research/connector-api/service';

export const runtime = 'nodejs';

type Ctx = { params: { id: string } };

/** Connector API v1 — connect session status (phase, message, liveViewUrl; never secrets). */
export async function GET(request: Request, { params }: Ctx) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const workspaceId = workspaceIdFromQuery(request);
    const session = await getConnectorSession(workspaceId, params.id);
    if (!session) {
      return NextResponse.json({ error: 'Connect session not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, session });
  } catch (error) {
    return connectorApiErrorResponse(error, 'Failed to load connect session.');
  }
}

/** Connector API v1 — cancel an in-flight connect session. */
export async function DELETE(request: Request, { params }: Ctx) {
  const auth = await requireResearchEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const workspaceId = workspaceIdFromQuery(request);
    const session = await cancelConnectorSession({ workspaceId, sessionId: params.id });
    return NextResponse.json({ ok: true, session, message: 'Connect session cancelled.' });
  } catch (error) {
    return connectorApiErrorResponse(error, 'Failed to cancel connect session.');
  }
}
