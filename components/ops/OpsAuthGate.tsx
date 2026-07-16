'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AUTH_STATUS_CODES,
  LOGIN_REDIRECT_CODES,
  type AuthStatusResponse,
} from '@/lib/auth/auth-status-types';

type OpsAuthGateProps = {
  initialAuth: AuthStatusResponse;
};

type GateState = 'loading' | 'db_error';

const RETRY_DELAYS_MS = [0, 500, 1500];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAuthStatusWithRetry(): Promise<AuthStatusResponse> {
  let last: AuthStatusResponse = {
    hasAdmin: false,
    authenticated: false,
    role: null,
    isSuperAdmin: false,
    user: null,
    opsAccess: false,
    code: AUTH_STATUS_CODES.DB_TIMEOUT,
    message: 'Authentication service temporarily unavailable.',
  };

  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
    if (RETRY_DELAYS_MS[attempt] > 0) {
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
    try {
      const response = await fetch('/api/auth/status', { credentials: 'include' });
      const data: AuthStatusResponse = await response.json();
      last = data;
      if (data.code !== AUTH_STATUS_CODES.DB_TIMEOUT) {
        return data;
      }
    } catch {
      last = {
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
  }

  return last;
}

export default function OpsAuthGate({ initialAuth }: OpsAuthGateProps) {
  const router = useRouter();
  const [state, setState] = useState<GateState>(
    initialAuth.code === AUTH_STATUS_CODES.DB_TIMEOUT ? 'db_error' : 'loading',
  );
  const [dbErrorMessage, setDbErrorMessage] = useState(
    initialAuth.message || 'Authentication service temporarily unavailable.',
  );
  const redirectStartedRef = useRef(false);
  const verifyRunRef = useRef(0);

  const clearSessionAndRedirectToLogin = useCallback(async () => {
    if (redirectStartedRef.current) return;
    redirectStartedRef.current = true;
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // Proceed to login even if logout call fails.
    }
    router.replace('/admin?returnTo=/ops');
  }, [router]);

  const handleAuthResult = useCallback(
    async (data: AuthStatusResponse) => {
      if (data.authenticated && data.opsAccess) {
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

      if (data.code && LOGIN_REDIRECT_CODES.has(data.code)) {
        await clearSessionAndRedirectToLogin();
        return;
      }

      if (!data.authenticated) {
        await clearSessionAndRedirectToLogin();
      }
    },
    [clearSessionAndRedirectToLogin, router],
  );

  const verify = useCallback(async () => {
    const runId = verifyRunRef.current + 1;
    verifyRunRef.current = runId;
    setState('loading');

    const data = await fetchAuthStatusWithRetry();
    if (verifyRunRef.current !== runId) return;

    await handleAuthResult(data);
  }, [handleAuthResult]);

  useEffect(() => {
    if (initialAuth.authenticated && initialAuth.opsAccess) {
      router.refresh();
      return;
    }

    if (initialAuth.code === AUTH_STATUS_CODES.DB_TIMEOUT) {
      return;
    }

    if (initialAuth.code && LOGIN_REDIRECT_CODES.has(initialAuth.code)) {
      void clearSessionAndRedirectToLogin();
      return;
    }

    if (!initialAuth.authenticated) {
      void clearSessionAndRedirectToLogin();
    }
  }, [clearSessionAndRedirectToLogin, initialAuth, router]);

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
      Checking access…
    </div>
  );
}
