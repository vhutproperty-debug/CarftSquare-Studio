'use client';

import { canAccess, isSuperAdmin } from '@/lib/auth/rbac/client';

export default function PermissionGate({
  user,
  module: moduleKey,
  action = 'view',
  children,
  fallback = null,
}) {
  if (!user || !canAccess(user, moduleKey, action)) {
    return fallback;
  }
  return children;
}

export function SuperAdminGate({ user, children, fallback = null }) {
  if (!isSuperAdmin(user)) return fallback;
  return children;
}
