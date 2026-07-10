import { MODULES } from '@/lib/auth/rbac/modules';

export const OPS_MODULE = MODULES.OPS;

export const OPS_PERMISSIONS = {
  dashboard: OPS_MODULE,
  leads: OPS_MODULE,
} as const;
