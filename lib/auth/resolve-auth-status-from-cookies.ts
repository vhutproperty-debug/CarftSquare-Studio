import { cookies } from 'next/headers';
import type { AuthStatusResponse } from '@/lib/auth/auth-status-types';
import { resolveAuthStatus } from '@/lib/auth/resolve-auth-status';

/** Server-side auth resolution using the same authority as GET /api/auth/status. */
export async function resolveAuthStatusFromCookies(): Promise<AuthStatusResponse> {
  const cookieStore = cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((entry) => `${entry.name}=${entry.value}`)
    .join('; ');

  const request = new Request('http://internal.local/api/auth/status', {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });

  return resolveAuthStatus(request);
}
