import { cookies } from 'next/headers';
import type { AuthStatusResponse } from '@/lib/auth/auth-status-types';
import { resolveAuthStatus } from '@/lib/auth/resolve-auth-status';
import { SESSION_COOKIE } from '@/lib/auth/session-constants';

/**
 * Server-side auth resolution using the same authority as GET /api/auth/status.
 * Reads the session cookie directly — avoids Request Cookie-header reconstruction.
 */
export async function resolveAuthStatusFromCookies(): Promise<AuthStatusResponse> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  const request = {
    cookies: {
      get(name: string) {
        if (name === SESSION_COOKIE && token) {
          return { value: token };
        }
        return undefined;
      },
    },
    headers: {
      get() {
        return null;
      },
    },
  } as unknown as Request;

  return resolveAuthStatus(request);
}
