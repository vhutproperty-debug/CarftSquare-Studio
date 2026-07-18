import type { ActionKey } from '@/lib/auth/rbac/actions';
import { methodToAction } from '@/lib/auth/rbac/actions';
import type { ModuleKey } from '@/lib/auth/rbac/modules';
import { MODULES } from '@/lib/auth/rbac/modules';
import { authorizeAdmin, type AuthResult } from '@/lib/auth/rbac/guard';
import { findAdminById, migrateLegacyAdmins, toPublicAdmin } from '@/lib/auth/rbac/store';
import type { PublicAdminUser } from '@/lib/auth/rbac/types';
import { withTimeout } from '@/lib/auth/async-timeout';
import { readSessionToken } from '@/lib/auth/session';
import { getSessionTokenFromRequest } from '@/lib/auth/session-constants';
import { getDb } from '@/lib/mongodb';
import { resolveRegisteredRoutePermission } from '@/lib/auth/rbac/registry';
import { isSuperAdmin } from '@/lib/auth/rbac/roles';

const AUTH_DB_TIMEOUT_MS = 6000;

/**
 * Same token extraction as middleware + /api/auth/status:
 * NextRequest cookies API, then Cookie header fallback.
 */
async function loadAdminFromSession(request: Request): Promise<PublicAdminUser | null> {
  const token = getSessionTokenFromRequest(request);
  const session = readSessionToken(token);
  if (!session?.id) return null;

  try {
    const db = await withTimeout(getDb(), AUTH_DB_TIMEOUT_MS, 'getDb');
    await migrateLegacyAdmins(db);
    const admin = await withTimeout(findAdminById(db, session.id), AUTH_DB_TIMEOUT_MS, 'findAdminById');
    const publicAdmin = toPublicAdmin(admin);
    if (publicAdmin && process.env.NODE_ENV !== 'production') {
      console.info('[rbac] session_admin_loaded', JSON.stringify({
        id: publicAdmin.id,
        email: publicAdmin.email,
        role: publicAdmin.role,
        isSuperAdmin: isSuperAdmin(publicAdmin),
        sessionRole: session.role,
      }));
    }
    return publicAdmin;
  } catch (error) {
    console.error('[rbac] session_admin_load_failed', error instanceof Error ? error.message : error);
    return null;
  }
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
  const admin = await loadAdminFromSession(request);
  const pathname = new URL(request.url).pathname;
  const registered = resolveRegisteredRoutePermission(request.method, pathname);
  const permission = options.permission || registered?.module || undefined;
  const action = options.action || registered?.action || methodToAction(request.method);
  return authorizeAdmin(admin, permission ? { permission, action } : {});
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
