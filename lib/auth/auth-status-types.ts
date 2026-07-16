import type { PublicAdminUser } from '@/lib/auth/rbac/types';

export const AUTH_STATUS_CODES = {
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  INVALID_SESSION: 'INVALID_SESSION',
  ADMIN_NOT_FOUND: 'ADMIN_NOT_FOUND',
  RBAC_DENIED: 'RBAC_DENIED',
  DB_TIMEOUT: 'DB_TIMEOUT',
} as const;

export type AuthStatusCode = (typeof AUTH_STATUS_CODES)[keyof typeof AUTH_STATUS_CODES];

export type AuthStatusUser = PublicAdminUser & { isSuperAdmin: boolean };

export type AuthStatusResponse = {
  hasAdmin: boolean;
  authenticated: boolean;
  role: string | null;
  isSuperAdmin: boolean;
  user: AuthStatusUser | null;
  opsAccess: boolean;
  code?: AuthStatusCode;
  message?: string;
};

export const LOGIN_REDIRECT_CODES: ReadonlySet<AuthStatusCode> = new Set([
  AUTH_STATUS_CODES.SESSION_EXPIRED,
  AUTH_STATUS_CODES.INVALID_SESSION,
  AUTH_STATUS_CODES.ADMIN_NOT_FOUND,
]);
