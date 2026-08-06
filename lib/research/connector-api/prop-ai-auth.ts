/**
 * Prop AI machine authentication for the existing Connector API.
 *
 * Allows a second credential alongside admin session cookies:
 *   Authorization: Bearer <PROP_AI_API_KEY>
 *   OR
 *   x-prop-ai-key: <PROP_AI_API_KEY>
 *
 * Scope (Phase 1): only status (view) and search (edit) routes should call
 * requireConnectorConsumerAccess. All other connector routes stay admin-only.
 */

import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { authResultToResponse, type AuthResult } from '@/lib/auth/rbac/guard';
import {
  requireResearchEditAccess,
  requireResearchViewAccess,
} from '@/lib/research/auth';

export type PropAiAuthSuccess = { ok: true; propAi: true };

export type ConnectorConsumerAuthResult = AuthResult | PropAiAuthSuccess;

function configuredPropAiApiKey(): string {
  return String(process.env.PROP_AI_API_KEY || '').trim();
}

/**
 * Returns the presented Prop AI key, or null if neither header was used.
 * An empty presented value is still "presented" so we do not fall through to cookies.
 */
export function extractPropAiApiKey(request: Request): string | null {
  if (request.headers.has('x-prop-ai-key')) {
    return String(request.headers.get('x-prop-ai-key') || '').trim();
  }

  const authorization = request.headers.get('authorization');
  if (authorization && /^Bearer\s+/i.test(authorization)) {
    return authorization.replace(/^Bearer\s+/i, '').trim();
  }

  return null;
}

function safeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

export function isValidPropAiApiKey(candidate: string | null | undefined): boolean {
  const expected = configuredPropAiApiKey();
  if (!expected || !candidate) return false;
  return safeEqualString(candidate, expected);
}

/**
 * Prop AI key (if presented) OR existing Research admin RBAC.
 * Invalid Prop AI credentials fail closed — they do not fall through to cookies.
 */
export async function requireConnectorConsumerAccess(
  request: Request,
  action: 'view' | 'edit',
): Promise<ConnectorConsumerAuthResult> {
  const presented = extractPropAiApiKey(request);
  if (presented !== null) {
    if (isValidPropAiApiKey(presented)) {
      return { ok: true, propAi: true };
    }
    return {
      ok: false,
      status: 401,
      message: 'Invalid Prop AI API key.',
    };
  }

  return action === 'view'
    ? requireResearchViewAccess(request)
    : requireResearchEditAccess(request);
}

export function connectorConsumerAuthToResponse(
  result: ConnectorConsumerAuthResult,
): NextResponse | null {
  if ('propAi' in result) return null;
  return authResultToResponse(result);
}
