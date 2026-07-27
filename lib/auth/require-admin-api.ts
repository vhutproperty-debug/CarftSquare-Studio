import type { ActionKey } from '@/lib/auth/rbac/actions';
import { methodToAction } from '@/lib/auth/rbac/actions';
import type { ModuleKey } from '@/lib/auth/rbac/modules';
import { MODULES } from '@/lib/auth/rbac/modules';
import { authorizeAdmin, type AuthResult } from '@/lib/auth/rbac/guard';
import { findAdminById, toPublicAdmin } from '@/lib/auth/rbac/store';
import type { PublicAdminUser } from '@/lib/auth/rbac/types';
import { AsyncTimeoutError, withTimeout } from '@/lib/auth/async-timeout';
import { inspectSessionToken } from '@/lib/auth/session';
import { getSessionTokenFromRequest } from '@/lib/auth/session-constants';
import { getDb, isMongoReady } from '@/lib/mongodb';
import { resolveRegisteredRoutePermission } from '@/lib/auth/rbac/registry';

const AUTH_DB_TIMEOUT_MS = 6000;

type AuthTraceReason =
  | 'ok'
  | 'no_cookie'
  | 'invalid_cookie'
  | 'expired_session'
  | 'admin_not_found'
  | 'mongo_timeout'
  | 'db_exception'
  | 'unexpected_null';

/** TEMP + permanent structured auth diagnostics (safe for production). */
function authTrace(
  step: string,
  detail: Record<string, unknown> & { reason?: AuthTraceReason },
) {
  console.info(
    JSON.stringify({
      tag: 'auth-trace',
      at: new Date().toISOString(),
      file: 'lib/auth/require-admin-api.ts',
      fn: 'loadAdminFromSession',
      step,
      ...detail,
    }),
  );
}

/**
 * Hot-path admin load for API authorization.
 * Does NOT run migrateLegacyAdmins (legacy migration is not required to authorize
 * an already-signed session; /api/auth/status and admin bootstrap still migrate).
 */
function isNextProductionBuild(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

async function loadAdminFromSession(request: Request): Promise<PublicAdminUser | null> {
  const t0 = Date.now();
  // During `next build` static generation, many routes invoke auth with no cookies.
  // Hitting Mongo here floods the build with timeouts and can hang past 10+ minutes.
  if (isNextProductionBuild()) {
    return null;
  }
  authTrace('request_start', { mongoReady: isMongoReady() });

  const token = getSessionTokenFromRequest(request);
  authTrace('cookie_parsed', {
    hasToken: Boolean(token),
    tokenLen: token ? String(token).length : 0,
    ms: Date.now() - t0,
  });

  const inspection = inspectSessionToken(token);
  authTrace('session_token_extracted', {
    state: inspection.state,
    sessionId: inspection.payload?.id ?? null,
    ms: Date.now() - t0,
  });

  if (inspection.state === 'missing') {
    authTrace('return', { reason: 'no_cookie', ms: Date.now() - t0 });
    return null;
  }
  if (inspection.state === 'invalid') {
    authTrace('return', { reason: 'invalid_cookie', ms: Date.now() - t0 });
    return null;
  }
  if (inspection.state === 'expired') {
    authTrace('return', { reason: 'expired_session', ms: Date.now() - t0 });
    return null;
  }

  const sessionId = inspection.payload?.id;
  if (!sessionId) {
    authTrace('return', { reason: 'unexpected_null', detail: 'valid_state_without_id', ms: Date.now() - t0 });
    return null;
  }

  try {
    const admin = await loadAdminRecordOnce(sessionId, t0);
    if (!admin) {
      authTrace('return', { reason: 'admin_not_found', sessionId, ms: Date.now() - t0 });
      return null;
    }
    authTrace('return', {
      reason: 'ok',
      sessionId,
      adminId: admin.id,
      ms: Date.now() - t0,
    });
    return admin;
  } catch (error) {
    if (error instanceof AsyncTimeoutError) {
      // Valid signed session must not become a generic 401 via null.
      // One warm retry: connection may now be cached after the timed-out attempt.
      authTrace('timeout_fired', {
        reason: 'mongo_timeout',
        message: error.message,
        mongoReady: isMongoReady(),
        ms: Date.now() - t0,
      });
      try {
        const retried = await loadAdminRecordOnce(sessionId, t0, { isRetry: true });
        if (retried) {
          authTrace('return', {
            reason: 'ok',
            sessionId,
            adminId: retried.id,
            afterRetry: true,
            ms: Date.now() - t0,
          });
          return retried;
        }
        authTrace('return', {
          reason: 'admin_not_found',
          sessionId,
          afterRetry: true,
          ms: Date.now() - t0,
        });
        return null;
      } catch (retryError) {
        authTrace('timeout_retry_failed', {
          reason: 'mongo_timeout',
          message: retryError instanceof Error ? retryError.message : String(retryError),
          ms: Date.now() - t0,
        });
        throw retryError instanceof AsyncTimeoutError
          ? retryError
          : new AsyncTimeoutError(
              retryError instanceof Error ? retryError.message : 'Admin auth DB timed out.',
            );
      }
    }

    authTrace('return', {
      reason: 'db_exception',
      message: error instanceof Error ? error.message : String(error),
      ms: Date.now() - t0,
    });
    console.error('[rbac] session_admin_load_failed', error instanceof Error ? error.message : error);
    return null;
  }
}

async function loadAdminRecordOnce(
  sessionId: string,
  t0: number,
  opts: { isRetry?: boolean } = {},
): Promise<PublicAdminUser | null> {
  const warm = isMongoReady();
  authTrace('mongo_connection_start', {
    warm,
    isRetry: Boolean(opts.isRetry),
    ms: Date.now() - t0,
  });

  // Warm isolate: reuse cached client with no timeout. Cold: keep connect budget.
  const db = warm
    ? await getDb()
    : await withTimeout(getDb(), AUTH_DB_TIMEOUT_MS, 'getDb');

  authTrace('mongo_connection_end', {
    warm: isMongoReady(),
    connectMs: Date.now() - t0,
    isRetry: Boolean(opts.isRetry),
  });

  authTrace('admin_lookup_start', { sessionId, ms: Date.now() - t0 });
  const lookupStarted = Date.now();
  const admin = await withTimeout(
    findAdminById(db, sessionId),
    AUTH_DB_TIMEOUT_MS,
    'findAdminById',
  );
  authTrace('admin_lookup_end', {
    sessionId,
    found: Boolean(admin),
    queryMs: Date.now() - lookupStarted,
    ms: Date.now() - t0,
  });

  return toPublicAdmin(admin);
}

export async function requireAuthFromRequest(request: Request): Promise<PublicAdminUser | null> {
  return loadAdminFromSession(request);
}

export async function authorizeRequest(
  request: Request,
  options: {
    permission?: ModuleKey | 'super_admin';
    action?: ActionKey;
  } = {},
): Promise<AuthResult> {
  try {
    const admin = await loadAdminFromSession(request);
    const pathname = new URL(request.url).pathname;
    const registered = resolveRegisteredRoutePermission(request.method, pathname);
    const permission = options.permission || registered?.module || undefined;
    const action = options.action || registered?.action || methodToAction(request.method);
    return authorizeAdmin(admin, permission ? { permission, action } : {});
  } catch (error) {
    if (error instanceof AsyncTimeoutError) {
      authTrace('authorize_timeout_503', {
        reason: 'mongo_timeout',
        message: error.message,
      });
      return {
        ok: false,
        status: 503,
        message: 'Authentication service temporarily unavailable.',
      };
    }
    throw error;
  }
}

export async function requireSuperAdminFromRequest(request: Request): Promise<PublicAdminUser | null> {
  const result = await authorizeRequest(request, { permission: 'super_admin' });
  return result.ok ? result.admin : null;
}

/** @deprecated Use authorizeRequest for 403 support. */
export async function requireAdminFromRequest(request: Request): Promise<PublicAdminUser | null> {
  const admin = await loadAdminFromSession(request);
  const result = authorizeAdmin(admin);
  return result.ok ? result.admin : null;
}

export async function requirePermissionFromRequest(
  request: Request,
  permission: ModuleKey,
  action?: ActionKey,
): Promise<AuthResult> {
  return authorizeRequest(request, { permission, action });
}

export { MODULES };
