import { isActiveAdmin, isSuperAdmin, ROLES } from '@/lib/auth/rbac/roles';

/**
 * Central operations permission helper.
 *
 * Module matrices in lib/auth/rbac still decide CMS access and stay backward
 * compatible for admin and super_admin. This helper is the business rule for
 * brokerage data: who may import, export, edit, delete, and which fields
 * leave the server.
 */

export type OpsPermission =
  | 'view'
  | 'remark'
  | 'fill_empty'
  | 'import'
  | 'export'
  | 'edit'
  | 'delete'
  | 'see_resale_private'
  | 'see_contact_fields'
  | 'see_owner_identity'
  | 'see_internal_apartment'
  | 'see_asking_negotiation'
  | 'see_builder_commercials'
  | 'see_internal_brokerage'
  | 'see_private_client'
  | 'manage_users'
  | 'assign';

export type AccessActor = {
  id?: string;
  email?: string;
  role?: string;
  status?: string;
  via?: 'session' | 'token';
} | null | undefined;

export type AssignedKind = 'contact' | 'supply' | 'deal' | 'demand' | 'resale' | 'client' | 'project' | 'generic';

const ALL_STAFF = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.OPS_EXEC,
  ROLES.SALES_EXEC,
  ROLES.INTERIOR,
  ROLES.BROKER,
] as const;

const TEAM = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.OPS_EXEC, ROLES.SALES_EXEC, ROLES.INTERIOR] as const;

/** Role matrix. Super admin is listed explicitly so tests can render it. */
export const OPS_PERMISSION_MATRIX: Record<OpsPermission, readonly string[]> = {
  view: ALL_STAFF,
  remark: TEAM,
  fill_empty: TEAM,
  import: [ROLES.SUPER_ADMIN],
  export: [ROLES.SUPER_ADMIN],
  edit: [ROLES.SUPER_ADMIN],
  delete: [ROLES.SUPER_ADMIN],
  see_resale_private: [ROLES.SUPER_ADMIN],
  see_contact_fields: TEAM,
  see_owner_identity: [ROLES.SUPER_ADMIN],
  see_internal_apartment: [ROLES.SUPER_ADMIN],
  see_asking_negotiation: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.SALES_EXEC],
  see_builder_commercials: [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  see_internal_brokerage: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.SALES_EXEC],
  see_private_client: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.SALES_EXEC, ROLES.INTERIOR],
  manage_users: [ROLES.SUPER_ADMIN],
  assign: [ROLES.SUPER_ADMIN, ROLES.ADMIN],
};

const ASSIGNED_KINDS = new Set<AssignedKind>(['contact', 'supply', 'deal', 'demand', 'resale', 'client']);

export function canOps(actor: AccessActor, permission: OpsPermission): boolean {
  if (!actor) return false;
  if (actor.via === 'token') return true;
  if (!isActiveAdmin(actor)) return false;
  if (isSuperAdmin(actor)) return true;
  const allowed = OPS_PERMISSION_MATRIX[permission];
  return Boolean(actor.role && allowed.includes(actor.role));
}

export function seesAllRecords(actor: AccessActor): boolean {
  if (!actor) return false;
  if (actor.via === 'token') return true;
  return actor.role === ROLES.SUPER_ADMIN || actor.role === ROLES.ADMIN;
}

function assigneeValues(record: object): string[] {
  const row = record as Record<string, unknown>;
  const keys = ['assignedTo', 'assignedBroker', 'assigneeId', 'brokerId', 'broker', 'createdBy'];
  const values: string[] = [];
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) values.push(value.trim().toLowerCase());
  }
  return values;
}

export function recordVisibleTo(actor: AccessActor, record: object | null | undefined, kind: AssignedKind = 'generic'): boolean {
  if (!actor || !record) return false;
  if (!canOps(actor, 'view')) return false;
  if (seesAllRecords(actor)) return true;
  const scoped = actor.role === ROLES.BROKER
    || actor.role === ROLES.OPS_EXEC
    || actor.role === ROLES.SALES_EXEC
    || actor.role === ROLES.INTERIOR;
  if (!scoped) return true;
  if (actor.role !== ROLES.BROKER && !ASSIGNED_KINDS.has(kind)) return true;
  if (actor.role === ROLES.BROKER && kind === 'project') return true;
  const wanted = [actor.id, actor.email].map((value) => String(value || '').trim().toLowerCase()).filter(Boolean);
  const assignees = assigneeValues(record);
  return wanted.some((value) => assignees.includes(value));
}

export function scopeRecords<T extends object>(actor: AccessActor, records: T[], kind: AssignedKind): T[] {
  if (seesAllRecords(actor)) return records;
  return records.filter((record) => recordVisibleTo(actor, record, kind));
}
