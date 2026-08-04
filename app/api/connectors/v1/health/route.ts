import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchViewAccess } from '@/lib/research/auth';
import {
  connectorApiErrorResponse,
  workspaceIdFromQuery,
} from '@/lib/research/connector-api/http';
import { getConnectorHealth } from '@/lib/research/connector-api/service';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Connector API v1 — worker + per-provider health report. */
export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const workspaceId = workspaceIdFromQuery(request);
    const health = await getConnectorHealth(workspaceId);
    return NextResponse.json({ ok: true, workspaceId, ...health });
  } catch (error) {
    return connectorApiErrorResponse(error, 'Failed to load connector health.');
  }
}
