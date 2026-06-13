import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
// @ts-expect-error JS module
import { getDb } from '@/lib/mongodb';
import { hashPassword } from '@/lib/auth/password';
import {
  createFullMatrix,
  normalizePermissionMatrix,
  type PermissionMatrix,
} from '@/lib/auth/rbac/matrix';
import {
  ADMIN_STATUSES,
  ROLES,
  isSuperAdmin,
} from '@/lib/auth/rbac/roles';
import type { AdminUser, AuditAction, AuditLog, PublicAdminUser } from '@/lib/auth/rbac/types';
import type { ModuleKey } from '@/lib/auth/rbac/modules';

import { withTimeout } from '@/lib/auth/async-timeout';

const ADMINS_COLLECTION = 'admins';
const AUDIT_COLLECTION = 'admin_activity_logs';

const ADMIN_QUERY_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, 'admin'];

/** Primary bootstrap account — promoted when no Super Admin exists. */
export const BOOTSTRAP_SUPER_ADMIN_EMAIL = 'vhutproperty@gmail.com';

const RBAC_DB_TIMEOUT_MS = 6000;
let rbacIndexesReady = false;
let rbacMigrationDone = false;
let rbacMigrationInFlight: Promise<void> | null = null;

function logRbacRole(action: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV !== 'production') {
    console.info(`[rbac] ${action}`, JSON.stringify(details));
  }
}

async function ensureRbacIndexesOnce(db: Db): Promise<void> {
  if (rbacIndexesReady) return;
  await withTimeout(ensureRbacIndexes(db), RBAC_DB_TIMEOUT_MS, 'ensureRbacIndexes');
  rbacIndexesReady = true;
}

export async function getDatabase(): Promise<Db> {
  return getDb();
}

export async function ensureRbacIndexes(db: Db): Promise<void> {
  await db.collection(ADMINS_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(ADMINS_COLLECTION).createIndex({ email: 1 }, { unique: true });
  await db.collection(ADMINS_COLLECTION).createIndex({ role: 1, status: 1 });
  await db.collection(ADMINS_COLLECTION).createIndex({ name: 1 });
  await db.collection(AUDIT_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(AUDIT_COLLECTION).createIndex({ createdAt: -1 });
  await db.collection(AUDIT_COLLECTION).createIndex({ actorId: 1, createdAt: -1 });
  await db.collection(AUDIT_COLLECTION).createIndex({ action: 1, createdAt: -1 });
  await db.collection(AUDIT_COLLECTION).createIndex({ module: 1, createdAt: -1 });
}

function normalizeStoredPermissions(input: unknown): PermissionMatrix {
  return normalizePermissionMatrix(input);
}

export async function migrateLegacyAdmins(db: Db): Promise<void> {
  if (rbacMigrationDone) return;
  if (rbacMigrationInFlight) {
    await rbacMigrationInFlight.catch(() => undefined);
    return;
  }

  rbacMigrationInFlight = (async () => {
    try {
      await ensureRbacIndexesOnce(db);

      const admins = await withTimeout(
        db.collection(ADMINS_COLLECTION)
          .find({}, { projection: { _id: 0, id: 1, email: 1, role: 1, status: 1, permissions: 1, createdAt: 1 } })
          .sort({ createdAt: 1 })
          .toArray(),
        RBAC_DB_TIMEOUT_MS,
        'migrateLegacyAdmins.find',
      );

      if (!admins.length) {
        rbacMigrationDone = true;
        return;
      }

      const now = new Date().toISOString();

      for (const admin of admins) {
        const patch: Record<string, unknown> = {};
        if (!admin.status) patch.status = ADMIN_STATUSES.ACTIVE;
        if (!admin.role) patch.role = ROLES.ADMIN;
        if (admin.permissions === undefined || admin.permissions === null) {
          patch.permissions = {};
        } else if (Array.isArray(admin.permissions)) {
          patch.permissions = normalizeStoredPermissions(admin.permissions);
        } else if (typeof admin.permissions === 'object') {
          patch.permissions = normalizeStoredPermissions(admin.permissions);
        }

        if (admin.role !== ROLES.SUPER_ADMIN && admin.role === 'admin') {
          patch.role = ROLES.ADMIN;
        }

        if (Object.keys(patch).length) {
          patch.updatedAt = now;
          await db.collection(ADMINS_COLLECTION).updateOne({ id: admin.id }, { $set: patch });
        }
      }

      await ensureSuperAdminExists(db);
      rbacMigrationDone = true;
    } catch (error) {
      console.error('[rbac] migrate_failed', error instanceof Error ? error.message : error);
    } finally {
      rbacMigrationInFlight = null;
    }
  })();

  await rbacMigrationInFlight.catch(() => undefined);
}

export async function ensureSuperAdminExists(db: Db): Promise<void> {
  try {
    const now = new Date().toISOString();
    const admins = await withTimeout(
      db.collection(ADMINS_COLLECTION)
        .find({}, { projection: { _id: 0, id: 1, email: 1, role: 1, status: 1, createdAt: 1 } })
        .sort({ createdAt: 1 })
        .toArray(),
      RBAC_DB_TIMEOUT_MS,
      'ensureSuperAdminExists.find',
    );

    if (!admins.length) return;

    const superAdmins = admins.filter((admin) => admin.role === ROLES.SUPER_ADMIN);
    if (superAdmins.length) {
      logRbacRole('super_admin_present', {
        count: superAdmins.length,
        emails: superAdmins.map((admin) => admin.email),
      });
      return;
    }

    const bootstrap = admins.find((admin) =>
      String(admin.email || '').toLowerCase() === BOOTSTRAP_SUPER_ADMIN_EMAIL,
    );
    const target = bootstrap || admins[0];

    if (!target?.id) return;

    await db.collection(ADMINS_COLLECTION).updateOne(
      { id: target.id },
      {
        $set: {
          role: ROLES.SUPER_ADMIN,
          status: target.status || ADMIN_STATUSES.ACTIVE,
          permissions: createFullMatrix(true),
          updatedAt: now,
        },
      },
    );

    logRbacRole('super_admin_promoted', {
      id: target.id,
      email: target.email,
      reason: bootstrap ? 'bootstrap_email' : 'oldest_admin',
    });
  } catch (error) {
    console.error('[rbac] ensure_super_admin_failed', error instanceof Error ? error.message : error);
  }
}

export function toPublicAdmin(admin: AdminUser | null): PublicAdminUser | null {
  if (!admin) return null;
  const { passwordHash, ...safe } = admin as AdminUser & { _id?: unknown };
  return safe;
}

export async function findAdminById(db: Db, id: string): Promise<AdminUser | null> {
  const admin = await db.collection(ADMINS_COLLECTION).findOne(
    { id, role: { $in: ADMIN_QUERY_ROLES } },
    { projection: { _id: 0 } },
  ) as AdminUser | null;

  if (admin) {
    logRbacRole('admin_loaded_by_id', {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      status: admin.status,
    });
  }

  return admin;
}

export async function findAdminByEmail(db: Db, email: string): Promise<AdminUser | null> {
  const admin = await db.collection(ADMINS_COLLECTION).findOne(
    { email: email.toLowerCase(), role: { $in: ADMIN_QUERY_ROLES } },
    { projection: { _id: 0 } },
  ) as AdminUser | null;

  if (admin) {
    logRbacRole('admin_loaded_by_email', {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      status: admin.status,
    });
  }

  return admin;
}

export async function listAdmins(
  db: Db,
  options: { q?: string; status?: 'active' | 'suspended' | 'all' } = {},
): Promise<PublicAdminUser[]> {
  await migrateLegacyAdmins(db);

  const query: Record<string, unknown> = { role: { $in: ADMIN_QUERY_ROLES } };
  if (options.status && options.status !== 'all') {
    query.status = options.status;
  }

  const rows = await db.collection(ADMINS_COLLECTION)
    .find(query, { projection: { _id: 0, passwordHash: 0 } })
    .sort({ createdAt: 1 })
    .toArray() as PublicAdminUser[];

  const q = String(options.q || '').trim().toLowerCase();
  if (!q) return rows;

  return rows.filter((admin) =>
    admin.name?.toLowerCase().includes(q)
    || admin.email?.toLowerCase().includes(q),
  );
}

export async function createAdmin(
  db: Db,
  input: {
    email: string;
    name: string;
    password: string;
    permissions?: PermissionMatrix;
    createdBy: string;
  },
): Promise<PublicAdminUser> {
  const now = new Date().toISOString();
  const admin: AdminUser = {
    id: uuidv4(),
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    role: ROLES.ADMIN,
    permissions: normalizeStoredPermissions(input.permissions || {}),
    status: ADMIN_STATUSES.ACTIVE,
    passwordHash: hashPassword(input.password),
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy,
  };

  await db.collection(ADMINS_COLLECTION).insertOne(admin);
  return toPublicAdmin(admin)!;
}

export async function updateAdmin(
  db: Db,
  id: string,
  patch: Partial<Pick<AdminUser, 'name' | 'email' | 'permissions' | 'status'>>,
): Promise<PublicAdminUser | null> {
  const existing = await findAdminById(db, id);
  if (!existing) return null;

  const update: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (patch.name !== undefined) update.name = String(patch.name).trim();
  if (patch.email !== undefined) update.email = String(patch.email).trim().toLowerCase();
  if (patch.permissions !== undefined) update.permissions = normalizeStoredPermissions(patch.permissions);
  if (patch.status !== undefined) update.status = patch.status;

  await db.collection(ADMINS_COLLECTION).updateOne({ id }, { $set: update });
  return findAdminById(db, id).then((admin) => toPublicAdmin(admin));
}

export async function countSuperAdmins(db: Db): Promise<number> {
  await migrateLegacyAdmins(db);
  return db.collection(ADMINS_COLLECTION).countDocuments({ role: ROLES.SUPER_ADMIN });
}

export async function deleteAdmin(db: Db, id: string): Promise<{ deleted: boolean; reason?: string }> {
  const existing = await findAdminById(db, id);
  if (!existing) return { deleted: false, reason: 'not_found' };
  if (isSuperAdmin(existing)) return { deleted: false, reason: 'super_admin_protected' };

  const result = await db.collection(ADMINS_COLLECTION).deleteOne({ id });
  return { deleted: result.deletedCount === 1 };
}

export async function setAdminStatus(
  db: Db,
  id: string,
  status: typeof ADMIN_STATUSES.ACTIVE | typeof ADMIN_STATUSES.SUSPENDED,
): Promise<PublicAdminUser | null> {
  const existing = await findAdminById(db, id);
  if (!existing) return null;
  if (isSuperAdmin(existing) && status === ADMIN_STATUSES.SUSPENDED) {
    return null;
  }
  return updateAdmin(db, id, { status });
}

export async function resetAdminPassword(db: Db, id: string, password: string): Promise<boolean> {
  const now = new Date().toISOString();
  const result = await db.collection(ADMINS_COLLECTION).updateOne(
    { id, role: { $in: ADMIN_QUERY_ROLES } },
    { $set: { passwordHash: hashPassword(password), updatedAt: now, passwordResetAt: now } },
  );
  return result.modifiedCount === 1;
}

export async function assignAdminPermissions(
  db: Db,
  id: string,
  permissions: PermissionMatrix,
): Promise<PublicAdminUser | null> {
  const existing = await findAdminById(db, id);
  if (!existing || isSuperAdmin(existing)) return null;
  return updateAdmin(db, id, { permissions: normalizeStoredPermissions(permissions) });
}

export async function recordAdminLogin(db: Db, id: string): Promise<void> {
  await db.collection(ADMINS_COLLECTION).updateOne(
    { id },
    { $set: { lastLoginAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
  );
}

export async function writeAuditLog(
  db: Db,
  entry: Omit<AuditLog, 'id' | 'createdAt'>,
): Promise<AuditLog> {
  await ensureRbacIndexes(db);
  const log: AuditLog = {
    ...entry,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
  };
  await db.collection(AUDIT_COLLECTION).insertOne(log);
  return log;
}

export async function listAuditLogs(
  db: Db,
  options: {
    limit?: number;
    actorId?: string;
    action?: AuditAction;
    module?: ModuleKey | 'auth' | 'admin' | 'system';
    q?: string;
  } = {},
): Promise<AuditLog[]> {
  await ensureRbacIndexes(db);
  const query: Record<string, unknown> = {};
  if (options.actorId) query.actorId = options.actorId;
  if (options.action) query.action = options.action;
  if (options.module) query.module = options.module;

  const limit = Math.min(500, Math.max(1, Number(options.limit) || 100));
  const rows = await db.collection(AUDIT_COLLECTION)
    .find(query, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray() as AuditLog[];

  const q = String(options.q || '').trim().toLowerCase();
  if (!q) return rows;

  return rows.filter((log) =>
    log.actorEmail?.toLowerCase().includes(q)
    || log.action?.toLowerCase().includes(q)
    || log.module?.toLowerCase().includes(q)
    || log.resource?.toLowerCase().includes(q)
    || JSON.stringify(log.details || {}).toLowerCase().includes(q),
  );
}

export async function countActiveAdmins(db: Db): Promise<number> {
  try {
    await migrateLegacyAdmins(db);
    return await withTimeout(
      db.collection(ADMINS_COLLECTION).countDocuments({ role: { $in: ADMIN_QUERY_ROLES } }),
      RBAC_DB_TIMEOUT_MS,
      'countActiveAdmins',
    );
  } catch (error) {
    console.error('[rbac] count_active_admins_failed', error instanceof Error ? error.message : error);
    return 0;
  }
}
