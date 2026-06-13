import {
  createFullMatrix,
  hasAnyModuleAccess,
  hasMatrixAction,
  isEmptyPermissionMatrix,
  normalizePermissionMatrix,
  type PermissionMatrix,
} from '@/lib/auth/rbac/matrix';
import { MODULE_KEYS, type ModuleKey } from '@/lib/auth/rbac/modules';
import { type ActionKey } from '@/lib/auth/rbac/actions';

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
} as const;

export type AdminRole = (typeof ROLES)[keyof typeof ROLES];

export const ADMIN_STATUSES = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
} as const;

export type AdminStatus = (typeof ADMIN_STATUSES)[keyof typeof ADMIN_STATUSES];

export function isSuperAdmin(admin: { role?: string } | null | undefined): boolean {
  return admin?.role === ROLES.SUPER_ADMIN;
}

export function isActiveAdmin(admin: { status?: string } | null | undefined): boolean {
  return !admin?.status || admin.status === ADMIN_STATUSES.ACTIVE;
}

function isLegacyFullAccess(admin: { permissions?: unknown } | null | undefined): boolean {
  if (!admin) return false;
  if (isSuperAdmin(admin)) return true;
  if (admin.permissions === undefined || admin.permissions === null) return true;
  if (Array.isArray(admin.permissions) && admin.permissions.length === 0) return true;
  if (typeof admin.permissions === 'object' && !Array.isArray(admin.permissions)) {
    return isEmptyPermissionMatrix(admin.permissions as PermissionMatrix);
  }
  return false;
}

/** Legacy admins without explicit permissions retain full access. */
export function resolveEffectiveMatrix(
  admin: { role?: string; permissions?: unknown } | null | undefined,
): PermissionMatrix {
  if (!admin) return {};
  if (isSuperAdmin(admin) || isLegacyFullAccess(admin)) {
    return createFullMatrix(true);
  }
  return normalizePermissionMatrix(admin.permissions);
}

/** @deprecated Alias for resolveEffectiveMatrix */
export function resolveEffectivePermissions(
  admin: { role?: string; permissions?: unknown } | null | undefined,
): ModuleKey[] {
  const matrix = resolveEffectiveMatrix(admin);
  return MODULE_KEYS.filter((moduleKey) => hasAnyModuleAccess(matrix, moduleKey));
}

export function hasPermission(
  admin: { role?: string; permissions?: unknown; status?: string } | null | undefined,
  moduleKey: ModuleKey,
  action?: ActionKey,
): boolean {
  if (!admin || !isActiveAdmin(admin)) return false;
  if (isSuperAdmin(admin)) return true;

  const matrix = resolveEffectiveMatrix(admin);
  if (action) return hasMatrixAction(matrix, moduleKey, action);
  return hasAnyModuleAccess(matrix, moduleKey);
}

export function hasAnyPermission(
  admin: { role?: string; permissions?: unknown; status?: string } | null | undefined,
  moduleKeys: ModuleKey[],
): boolean {
  return moduleKeys.some((moduleKey) => hasPermission(admin, moduleKey));
}

export function canPerformAction(
  admin: { role?: string; permissions?: unknown; status?: string } | null | undefined,
  moduleKey: ModuleKey,
  action: ActionKey,
): boolean {
  return hasPermission(admin, moduleKey, action);
}
