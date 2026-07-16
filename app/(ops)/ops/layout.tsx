import type { Metadata } from 'next';
import OpsAccessDenied from '@/components/ops/OpsAccessDenied';
import OpsAuthGate from '@/components/ops/OpsAuthGate';
import { AUTH_STATUS_CODES, type AuthStatusResponse } from '@/lib/auth/auth-status-types';
import { resolveAuthStatusFromCookies } from '@/lib/auth/resolve-auth-status-from-cookies';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Operations – CraftSquare Studio',
  robots: { index: false, follow: false },
};

function dbTimeoutAuthStatus(): AuthStatusResponse {
  return {
    hasAdmin: false,
    authenticated: false,
    role: null,
    isSuperAdmin: false,
    user: null,
    opsAccess: false,
    code: AUTH_STATUS_CODES.DB_TIMEOUT,
    message: 'Authentication service temporarily unavailable.',
  };
}

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  let auth: AuthStatusResponse;
  try {
    auth = await resolveAuthStatusFromCookies();
  } catch (error) {
    console.error('[ops] layout_auth_resolve_failed', error instanceof Error ? error.message : error);
    auth = dbTimeoutAuthStatus();
  }

  if (auth.authenticated && auth.opsAccess) {
    return children;
  }

  if (auth.code === AUTH_STATUS_CODES.RBAC_DENIED) {
    return <OpsAccessDenied message={auth.message} />;
  }

  return <OpsAuthGate initialAuth={auth} />;
}
