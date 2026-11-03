import type { PublicAdminUser } from '@/lib/auth/rbac/types';
import { canOps } from '@/lib/ops/os/permissions';

/** Flat numbers and owner contacts. Super admin only. */
export function canSeeResalePrivate(admin: PublicAdminUser | null | undefined): boolean {
  return canOps(admin, 'see_resale_private');
}

/** Import, edit, and delete of inventory. Super admin only. */
export function canManageProjects(admin: PublicAdminUser | null | undefined): boolean {
  return canOps(admin, 'edit');
}
