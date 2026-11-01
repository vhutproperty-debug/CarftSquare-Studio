'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  AUTH_STATUS_CODES,
  LOGIN_REDIRECT_CODES,
  type AuthStatusResponse,
} from '@/lib/auth/auth-status-types';
import { fetchAuthStatusWithRetry } from '@/lib/auth/fetch-auth-status';
import { isSafeOpsReturnTo } from '@/lib/auth/safe-ops-return-to';

type OpsAuthGateProps = {
  initialAuth: AuthStatusResponse;
};

type GateState = 'loading' | 'db_error';

export default function OpsAuthGate({ initialAuth }: OpsAuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<GateState>('loading');
  const [statusLine, setStatusLine] = useState('Checking access…');
  const [dbErrorMessage, setDbErrorMessage] = useState(
    initialAuth.message || 'Authentication service temporarily unavailable.',
  );
  const redirectStartedRef = useRef(false);
  const verifyRunRef = useRef(0);

  const redirectToLogin = useCallback(() => {
    if (redirectStartedRef.current) return;
    redirectStartedRef.current = true;
    const returnTo = isSafeOpsReturnTo(pathname) ? pathname : '/ops';
    router.replace(`/admin?returnTo=${encodeURIComponent(returnTo)}`);
  }, [pathname, router]);

  const handleAuthResult = useCallback(
    (data: AuthStatusResponse) => {
      if (data.authenticated && data.opsAccess) {
        router.refresh();
        return;
      }

      if (data.authenticated && !data.opsAccess) {
        router.refresh();
        return;
      }

      if (data.code === AUTH_STATUS_CODES.RBAC_DENIED) {
        router.refresh();
        return;
      }

      if (data.code === AUTH_STATUS_CODES.DB_TIMEOUT) {
        setDbErrorMessage(data.message || 'Authentication service temporarily unavailable.');
        setState('db_error');
        return;
      }

      if ((data.code && LOGIN_REDIRECT_CODES.has(data.code)) || !data.authenticated) {
        redirectToLogin();
      }
    },
    [redirectToLogin, router],
  );

  const verify = useCallback(async () => {
    const runId = verifyRunRef.current + 1;
    verifyRunRef.current = runId;
    setState('loading');
    setStatusLine('Checking access…');

    const data = await fetchAuthStatusWithRetry({
      onAttempt: (attempt) => {
        if (verifyRunRef.current !== runId) return;
        if (attempt > 0) setStatusLine('Retrying access check…');
      },
    });
    if (verifyRunRef.current !== runId) return;

    handleAuthResult(data);
  }, [handleAuthResult]);

  useEffect(() => {
    // Always re-check via /api/auth/status before sending users to legacy /admin.
    // Do not logout here — that destroyed valid sessions on server false-negatives.
    // DB_TIMEOUT is retried with backoff; a hung status call aborts instead of spinning.
    if (initialAuth.authenticated && initialAuth.opsAccess) {
      router.refresh();
      return;
    }

    void verify();
  }, [initialAuth, router, verify]);

  if (state === 'db_error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 text-center">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Connection issue</h1>
          <p className="mt-3 text-sm text-slate-600">
            {dbErrorMessage || 'Authentication service temporarily unavailable.'}
          </p>
          <p className="mt-2 text-xs text-slate-500">Retrying does not sign you out.</p>
          <button
            type="button"
            onClick={() => verify()}
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500">
      {statusLine}
    </div>
  );
}
