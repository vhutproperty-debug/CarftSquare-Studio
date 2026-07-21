import { NextResponse } from 'next/server';
import type { ActionKey } from '@/lib/auth/rbac/actions';
import type { ModuleKey } from '@/lib/auth/rbac/modules';
import { hasPermission, isActiveAdmin, isSuperAdmin } from '@/lib/auth/rbac/roles';
import type { PublicAdminUser } from '@/lib/auth/rbac/types';

export type AuthResult =
  | { ok: true; admin: PublicAdminUser }
  | { ok: false; status: 401 | 403 | 503; message: string };

export function unauthorizedResponse(message = 'Admin authentication required.') {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbiddenResponse(message = 'You do not have permission to perform this action.') {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function serviceUnavailableResponse(
  message = 'Authentication service temporarily unavailable.',
) {
  return NextResponse.json({ error: message }, { status: 503 });
}

export function authorizeAdmin(
  admin: PublicAdminUser | null,
  options: {
    permission?: ModuleKey | 'super_admin';
    action?: ActionKey;
    suspendedMessage?: string;
  } = {},
): AuthResult {
  if (!admin) {
    return { ok: false, status: 401, message: 'Admin authentication required.' };
  }

  if (!isActiveAdmin(admin)) {
    return {
      ok: false,
      status: 403,
      message: options.suspendedMessage || 'This admin account is suspended.',
    };
  }

  if (options.permission === 'super_admin') {
    if (!isSuperAdmin(admin)) {
      return { ok: false, status: 403, message: 'Super Admin access required.' };
    }
    return { ok: true, admin };
  }

  if (options.permission) {
    const action = options.action || 'view';
    if (!hasPermission(admin, options.permission, action)) {
      return { ok: false, status: 403, message: 'You do not have permission to perform this action.' };
    }
  }

  return { ok: true, admin };
}

export function authResultToResponse(result: AuthResult) {
  if (result.ok === false) {
    if (result.status === 401) return unauthorizedResponse(result.message);
    if (result.status === 503) return serviceUnavailableResponse(result.message);
    return forbiddenResponse(result.message);
  }
  return null;
}
