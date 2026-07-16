import { AsyncTimeoutError, withTimeout } from '@/lib/auth/async-timeout';
import {
  AUTH_STATUS_CODES,
  type AuthStatusCode,
  type AuthStatusResponse,
  type AuthStatusUser,
} from '@/lib/auth/auth-status-types';
import { hasPermission, isActiveAdmin, isSuperAdmin } from '@/lib/auth/rbac/roles';
import { countActiveAdmins, findAdminById, migrateLegacyAdmins, toPublicAdmin } from '@/lib/auth/rbac/store';
import { getSessionTokenFromRequest } from '@/lib/auth/session-constants';
import { inspectSessionToken } from '@/lib/auth/session';
import { getDb } from '@/lib/mongodb';

const AUTH_DB_TIMEOUT_MS = 6000;

function failure(
  code: AuthStatusCode,
  message: string,
  extras: Partial<AuthStatusResponse> = {},
): AuthStatusResponse {
  return {
    hasAdmin: extras.hasAdmin ?? false,
    authenticated: false,
    role: extras.role ?? extras.user?.role ?? null,
    isSuperAdmin: extras.isSuperAdmin ?? extras.user?.isSuperAdmin ?? false,
    user: extras.user ?? null,
    opsAccess: false,
    code,
    message,
  };
}

function success(user: AuthStatusUser, hasAdmin: boolean): AuthStatusResponse {
  return {
    hasAdmin,
    authenticated: true,
    role: user.role,
    isSuperAdmin: user.isSuperAdmin,
    user,
    opsAccess: true,
  };
}

/** Single authorization authority for admin session, RBAC, and ops access. */
export async function resolveAuthStatus(request: Request): Promise<AuthStatusResponse> {
  const token = getSessionTokenFromRequest(request);
  const inspection = inspectSessionToken(token);

  if (inspection.state === 'missing' || inspection.state === 'invalid') {
    return failure(AUTH_STATUS_CODES.INVALID_SESSION, 'Invalid or missing session.');
  }
  if (inspection.state === 'expired') {
    return failure(AUTH_STATUS_CODES.SESSION_EXPIRED, 'Session has expired.');
  }

  const sessionId = inspection.payload.id;
  if (!sessionId) {
    return failure(AUTH_STATUS_CODES.INVALID_SESSION, 'Invalid session payload.');
  }

  try {
    const db = await withTimeout(getDb(), AUTH_DB_TIMEOUT_MS, 'getDb');
    await withTimeout(migrateLegacyAdmins(db), AUTH_DB_TIMEOUT_MS, 'migrateLegacyAdmins');
    const hasAdmin =
      (await withTimeout(countActiveAdmins(db), AUTH_DB_TIMEOUT_MS, 'countActiveAdmins')) > 0;

    const adminRecord = await withTimeout(findAdminById(db, sessionId), AUTH_DB_TIMEOUT_MS, 'findAdminById');
    if (!adminRecord) {
      return failure(AUTH_STATUS_CODES.ADMIN_NOT_FOUND, 'Admin account not found.', { hasAdmin });
    }

    const publicAdmin = toPublicAdmin(adminRecord);
    if (!publicAdmin) {
      return failure(AUTH_STATUS_CODES.ADMIN_NOT_FOUND, 'Admin account not found.', { hasAdmin });
    }

    const user: AuthStatusUser = { ...publicAdmin, isSuperAdmin: isSuperAdmin(publicAdmin) };

    if (!isActiveAdmin(user)) {
      return failure(AUTH_STATUS_CODES.RBAC_DENIED, 'This admin account is suspended.', { hasAdmin, user });
    }

    if (!hasPermission(user, 'ops', 'view')) {
      return failure(
        AUTH_STATUS_CODES.RBAC_DENIED,
        'You do not have permission to access Operations.',
        { hasAdmin, user },
      );
    }

    return success(user, hasAdmin);
  } catch (error) {
    if (error instanceof AsyncTimeoutError) {
      return failure(
        AUTH_STATUS_CODES.DB_TIMEOUT,
        'Authentication service temporarily unavailable.',
      );
    }
    console.error('[auth] resolve_auth_status_failed', error instanceof Error ? error.message : error);
    return failure(
      AUTH_STATUS_CODES.DB_TIMEOUT,
      'Authentication service temporarily unavailable.',
    );
  }
}
