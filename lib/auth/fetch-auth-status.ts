import {
  AUTH_STATUS_CODES,
  type AuthStatusResponse,
} from '@/lib/auth/auth-status-types';

/** Slightly above the server route cap so a finished 503 is received. */
export const AUTH_STATUS_FETCH_TIMEOUT_MS = 30_000;

/** Immediate check, then backoff. A hung fetch aborts instead of spinning. */
export const AUTH_STATUS_RETRY_DELAYS_MS = [0, 800, 2000];

export function unavailableAuthStatus(
  message = 'Authentication service temporarily unavailable.',
): AuthStatusResponse {
  return {
    hasAdmin: false,
    authenticated: false,
    role: null,
    isSuperAdmin: false,
    user: null,
    opsAccess: false,
    researchAccess: false,
    code: AUTH_STATUS_CODES.DB_TIMEOUT,
    message,
  };
}

type AuthStatusFetchInit = {
  credentials: 'include';
  signal: AbortSignal;
  cache: 'no-store';
};

type AuthStatusResponseLike = {
  json: () => Promise<AuthStatusResponse>;
};

export type FetchAuthStatusOptions = {
  fetchImpl?: (input: string, init: AuthStatusFetchInit) => Promise<AuthStatusResponseLike>;
  delaysMs?: number[];
  timeoutMs?: number;
  sleepImpl?: (ms: number) => Promise<void>;
  onAttempt?: (attempt: number) => void;
};

function defaultSleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function fetchAuthStatusWithRetry(
  options: FetchAuthStatusOptions = {},
): Promise<AuthStatusResponse> {
  const delays = options.delaysMs ?? AUTH_STATUS_RETRY_DELAYS_MS;
  const timeoutMs = options.timeoutMs ?? AUTH_STATUS_FETCH_TIMEOUT_MS;
  const sleep = options.sleepImpl ?? defaultSleep;
  const fetchImpl = options.fetchImpl
    ?? ((input: string, init: AuthStatusFetchInit) => fetch(input, init));

  let last = unavailableAuthStatus();

  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt] > 0) {
      await sleep(delays[attempt]);
    }
    options.onAttempt?.(attempt);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl('/api/auth/status', {
        credentials: 'include',
        signal: controller.signal,
        cache: 'no-store',
      });
      const data = await response.json();
      last = data && typeof data === 'object' ? data : unavailableAuthStatus();
      if (last.code !== AUTH_STATUS_CODES.DB_TIMEOUT) {
        return last;
      }
    } catch {
      last = unavailableAuthStatus();
    } finally {
      clearTimeout(timer);
    }
  }

  return last;
}
