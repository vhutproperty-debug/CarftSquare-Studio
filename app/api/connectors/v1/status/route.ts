import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchViewAccess } from '@/lib/research/auth';
import {
  connectorApiErrorResponse,
  workspaceIdFromQuery,
} from '@/lib/research/connector-api/http';
import { getConnectorStatuses } from '@/lib/research/connector-api/service';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Connector API v1 — provider-agnostic authentication status per provider. */
export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const workspaceId = workspaceIdFromQuery(request);
    const { providers, workerOnline } = await getConnectorStatuses(workspaceId);
    return NextResponse.json({ ok: true, workspaceId, workerOnline, providers });
  } catch (error) {
    return connectorApiErrorResponse(error, 'Failed to load connector statuses.');
  }
}
