import { AsyncTimeoutError, withTimeout } from '@/lib/auth/async-timeout';

/**
 * Must stay above Mongo serverSelectionTimeoutMS (5s) so a cold Atlas
 * selection can finish before auth gives up.
 */
export const AUTH_DB_TIMEOUT_MS = 12_000;

/**
 * Hard cap for /api/auth/status and /api/auth/login.
 * Leaves room for one 12s attempt plus one retry, and stays under 30s.
 */
export const AUTH_ROUTE_TIMEOUT_MS = 28_000;

const TRANSIENT_AUTH_DB_ERROR =
  /timed out|timeout|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|EPIPE|MongoNetwork|MongoServerSelection|server selection|topology was destroyed|socket|querySrv|not primary|EHOSTUNREACH|ENETUNREACH|connection .*closed/i;

export function isTransientAuthDbError(error: unknown): boolean {
  if (error instanceof AsyncTimeoutError) return true;
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : String(error ?? '');
  return TRANSIENT_AUTH_DB_ERROR.test(`${name} ${message}`);
}

/**
 * Run a DB-backed auth step once, then retry exactly once on timeout or a
 * transient network error. The retry reuses the cached MongoClient promise.
 */
export async function withAuthDbRetry<T>(
  fn: () => Promise<T>,
  label: string,
  timeoutMs = AUTH_DB_TIMEOUT_MS,
): Promise<T> {
  try {
    return await withTimeout(fn(), timeoutMs, label);
  } catch (error) {
    if (!isTransientAuthDbError(error)) throw error;
    console.error(`[auth] ${label}_retry`, error instanceof Error ? error.message : error);
    return withTimeout(fn(), timeoutMs, `${label}_retry`);
  }
}
