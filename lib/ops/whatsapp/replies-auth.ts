import { NextResponse } from 'next/server';
import { bearerToken, opsApiTokenMatches } from '@/lib/ops/projects/api-auth';

/**
 * Read-only assistant access. A bearer token is required; an admin session
 * cookie is not accepted on this path. Comparison is timing-safe via
 * opsApiTokenMatches. Returns a 401 response, or null when the token matches.
 */
export function authorizeWhatsAppReplies(request: Request): Response | null {
  if (!bearerToken(request)) {
    return NextResponse.json({ error: 'OPS API token is required.' }, { status: 401 });
  }
  if (!process.env.OPS_API_TOKEN?.trim()) {
    return NextResponse.json({ error: 'OPS API token is not configured.' }, { status: 401 });
  }
  if (!opsApiTokenMatches(request)) {
    return NextResponse.json({ error: 'Invalid OPS API token.' }, { status: 401 });
  }
  return null;
}
