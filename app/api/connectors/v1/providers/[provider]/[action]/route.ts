import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchEditAccess } from '@/lib/research/auth';
import {
  connectorApiErrorResponse,
  resolveWorkspaceId,
} from '@/lib/research/connector-api/http';
import {
  disconnectConnectorProvider,
  reconnectConnectorProvider,
  refreshConnectorProvider,
  validateConnectorProvider,
} from '@/lib/research/connector-api/service';

export const runtime = 'nodejs';
export const maxDuration = 120;

type Ctx = { params: { provider: string; action: string } };

/**
 * Connector API v1 — provider lifecycle actions.
 * POST /api/connectors/v1/providers/{provider}/{action}
 * Actions: disconnect | reconnect | refresh | validate.
 * Body: { workspaceId?, force? (validate only) }.
 */
export async function POST(request: Request, { params }: Ctx) {
  const auth = await requireResearchEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!auth.ok) return denied!;

  const provider = params.provider;
  const action = String(params.action || '').toLowerCase();

  try {
    const body = await request.json().catch(() => ({}));
    const workspaceId = resolveWorkspaceId(body.workspaceId);
    const actorId = auth.admin.id;

    switch (action) {
      case 'disconnect': {
        await disconnectConnectorProvider({ workspaceId, provider, actorId });
        return NextResponse.json({ ok: true, message: `${provider} disconnected.` });
      }
      case 'reconnect': {
        const session = await reconnectConnectorProvider({ workspaceId, provider, actorId });
        return NextResponse.json({
          ok: true,
          session,
          message: 'Reconnect queued — complete login via LiveView.',
        });
      }
      case 'refresh': {
        const result = await refreshConnectorProvider({ workspaceId, provider, actorId });
        return NextResponse.json({ ok: true, ...result });
      }
      case 'validate': {
        const result = await validateConnectorProvider({
          workspaceId,
          provider,
          force: Boolean(body.force),
        });
        return NextResponse.json({ ok: result.ok, ...result });
      }
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Use disconnect | reconnect | refresh | validate.` },
          { status: 400 },
        );
    }
  } catch (error) {
    return connectorApiErrorResponse(error, `Failed to ${action} ${provider}.`);
  }
}
