import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchViewAccess } from '@/lib/research/auth';
import { connectorApiErrorResponse } from '@/lib/research/connector-api/http';
import { listConnectorProviders } from '@/lib/research/connector-api/service';

export const runtime = 'nodejs';

/** Connector API v1 — list registered providers and their capabilities. */
export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    return NextResponse.json({ ok: true, providers: listConnectorProviders() });
  } catch (error) {
    return connectorApiErrorResponse(error, 'Failed to list providers.');
  }
}
