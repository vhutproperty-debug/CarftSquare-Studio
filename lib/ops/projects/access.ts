import { hasPermission } from '@/lib/auth/rbac/roles';
import type { PublicAdminUser } from '@/lib/auth/rbac/types';
import { OPS_MODULE } from '@/lib/ops/permissions';

function isAdminRole(admin: { role?: string; status?: string } | null | undefined): boolean {
  if (!admin || admin.status === 'suspended') return false;
  return admin.role === 'admin' || admin.role === 'super_admin';
}

/** Flat numbers and owner contacts. Non-admin roles never receive them. */
export function canSeeResalePrivate(admin: PublicAdminUser | null | undefined): boolean {
  return isAdminRole(admin);
}

/** Add, edit, and delete. Ops viewers who are not admins, or admins without edit, cannot. */
export function canManageProjects(admin: PublicAdminUser | null | undefined): boolean {
  return isAdminRole(admin) && hasPermission(admin, OPS_MODULE, 'edit');
}
