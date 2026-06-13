import { z } from 'zod';
import { ACTION_KEYS } from '@/lib/auth/rbac/actions';
import { MODULE_KEYS } from '@/lib/auth/rbac/modules';

const actionGrantSchema = z.object({
  view: z.boolean().optional(),
  create: z.boolean().optional(),
  edit: z.boolean().optional(),
  delete: z.boolean().optional(),
  publish: z.boolean().optional(),
  archive: z.boolean().optional(),
}).partial();

const permissionMatrixSchema = z.record(
  z.enum(MODULE_KEYS as [string, ...string[]]),
  actionGrantSchema,
).optional().default({});

export const createAdminSchema = z.object({
  email: z.string().trim().email().max(254),
  name: z.string().trim().min(2).max(120),
  password: z.string().min(8).max(128),
  permissions: permissionMatrixSchema,
});

export const updateAdminSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().max(254).optional(),
});

export const assignPermissionsSchema = z.object({
  permissions: permissionMatrixSchema,
});

export const resetAdminPasswordSchema = z.object({
  password: z.string().min(8).max(128),
});

export const listAdminsQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: z.enum(['active', 'suspended', 'all']).optional().default('all'),
});

export const listAuditLogsQuerySchema = z.object({
  q: z.string().trim().optional(),
  actorId: z.string().trim().optional(),
  action: z.string().trim().optional(),
  module: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
});

export { ACTION_KEYS };
