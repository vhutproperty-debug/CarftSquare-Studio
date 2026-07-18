import type { Metadata } from 'next';
import ResearchAccessDenied from '@/components/research/ResearchAccessDenied';
import ResearchAuthGate from '@/components/research/ResearchAuthGate';
import { AUTH_STATUS_CODES, type AuthStatusResponse } from '@/lib/auth/auth-status-types';
import { resolveAuthStatusFromCookies } from '@/lib/auth/resolve-auth-status-from-cookies';
import { ensureResearchIndexes } from '@/lib/research/store';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Prop/Research – CraftSquare Studio',
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
    researchAccess: false,
    code: AUTH_STATUS_CODES.DB_TIMEOUT,
    message: 'Authentication service temporarily unavailable.',
  };
}

export default async function ResearchLayout({ children }: { children: React.ReactNode }) {
  let auth: AuthStatusResponse;
  try {
    auth = await resolveAuthStatusFromCookies();
  } catch (error) {
    console.error('[research] layout_auth_resolve_failed', error instanceof Error ? error.message : error);
    auth = dbTimeoutAuthStatus();
  }

  if (auth.authenticated && auth.researchAccess) {
    try {
      await ensureResearchIndexes();
    } catch (error) {
      console.error('[research] index_ensure_failed', error instanceof Error ? error.message : error);
    }
    return children;
  }

  if (auth.authenticated && !auth.researchAccess) {
    return (
      <ResearchAccessDenied
        message={auth.message || 'You do not have permission to access Prop/Research.'}
      />
    );
  }

  if (auth.code === AUTH_STATUS_CODES.RBAC_DENIED) {
    return <ResearchAccessDenied message={auth.message} />;
  }

  return <ResearchAuthGate initialAuth={auth} />;
}
