import { cookies } from 'next/headers';
import type { AuthStatusResponse } from '@/lib/auth/auth-status-types';
import { resolveAuthStatus } from '@/lib/auth/resolve-auth-status';
import {
  cookieHeaderFromPairs,
  sessionTokenFromCookieSources,
} from '@/lib/auth/session-cookie';
import { SESSION_COOKIE } from '@/lib/auth/session-constants';

/**
 * Server-side auth resolution using the same authority as GET /api/auth/status.
 * The synthetic Request keeps both the cookie store and the Cookie header so
 * session lookup matches requireOpsViewAccess / loadAdminFromSession.
 */
export async function resolveAuthStatusFromCookies(): Promise<AuthStatusResponse> {
  const cookieStore = cookies();
  const pairs = cookieStore.getAll().map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
  }));
  const cookieHeader = cookieHeaderFromPairs(pairs);
  const token = sessionTokenFromCookieSources({
    direct: cookieStore.get(SESSION_COOKIE)?.value,
    cookieHeader,
  });

  const request = {
    cookies: {
      get(name: string) {
        if (name === SESSION_COOKIE && token) return { value: token };
        const found = pairs.filter((cookie) => cookie.name === name && cookie.value);
        const value = found.length ? found[found.length - 1].value : undefined;
        return value ? { value } : undefined;
      },
    },
    headers: {
      get(name: string) {
        if (String(name || '').toLowerCase() === 'cookie') return cookieHeader;
        return null;
      },
    },
  } as unknown as Request;

  return resolveAuthStatus(request);
}
