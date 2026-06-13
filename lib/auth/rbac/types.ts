import type { AdminRole, AdminStatus } from '@/lib/auth/rbac/roles';
import type { PermissionMatrix } from '@/lib/auth/rbac/matrix';
import type { ModuleKey } from '@/lib/auth/rbac/modules';

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  permissions: PermissionMatrix;
  status: AdminStatus;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  passwordResetAt?: string;
  createdBy?: string;
  lastLoginAt?: string;
};

export type PublicAdminUser = Omit<AdminUser, 'passwordHash'>;

export type AuditAction =
  | 'login'
  | 'logout'
  | 'create'
  | 'edit'
  | 'delete'
  | 'publish'
  | 'archive'
  | 'suspend'
  | 'activate'
  | 'reset_password'
  | 'assign_permissions'
  | 'admin_creation'
  | 'admin_deletion'
  | 'permission_change'
  | 'suspension'
  | 'activation';

export type AuditLog = {
  id: string;
  actorId: string;
  actorEmail: string;
  action: AuditAction;
  module: ModuleKey | 'auth' | 'admin' | 'system';
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: string;
};
