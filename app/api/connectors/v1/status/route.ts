import { NextResponse } from 'next/server';
import {
  connectorApiErrorResponse,
  workspaceIdFromQuery,
} from '@/lib/research/connector-api/http';
import {
  connectorConsumerAuthToResponse,
  requireConnectorConsumerAccess,
} from '@/lib/research/connector-api/prop-ai-auth';
import { getConnectorStatuses } from '@/lib/research/connector-api/service';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Connector API v1 — provider-agnostic authentication status per provider. */
export async function GET(request: Request) {
  // Prop AI machine key OR admin Research view RBAC (admin UI unchanged).
  const auth = await requireConnectorConsumerAccess(request, 'view');
  const denied = connectorConsumerAuthToResponse(auth);
  if (denied) return denied;

  try {
    const workspaceId = workspaceIdFromQuery(request);
    const { providers, workerOnline } = await getConnectorStatuses(workspaceId);
    return NextResponse.json({ ok: true, workspaceId, workerOnline, providers });
  } catch (error) {
    return connectorApiErrorResponse(error, 'Failed to load connector statuses.');
  }
}
