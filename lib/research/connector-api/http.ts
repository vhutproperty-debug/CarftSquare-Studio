/**
 * Shared HTTP helpers for the Connector API routes (app/api/connectors/v1/**).
 * Keeps envelopes consistent with the rest of the platform:
 * success → { ok: true, ... }, failure → { error } with a meaningful status.
 */

import { NextResponse } from 'next/server';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import { ConnectorApiError } from '@/lib/research/connector-api/service';

export function resolveWorkspaceId(value: unknown): string {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : DEFAULT_RESEARCH_WORKSPACE.id;
}

export function workspaceIdFromQuery(request: Request): string {
  const url = new URL(request.url);
  return resolveWorkspaceId(url.searchParams.get('workspaceId'));
}

export function connectorApiErrorResponse(error: unknown, fallback: string): NextResponse {
  if (error instanceof ConnectorApiError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode });
  }
  console.error('[connector-api]', fallback, error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 500 },
  );
}
