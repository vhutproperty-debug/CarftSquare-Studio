import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';

export const OPS_AUDIT_COLLECTION = 'ops_audit_events';

export type OpsAuditEvent = {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  entity: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  at: string;
};

export type OpsAuditInput = {
  actorId: string;
  actorEmail?: string;
  action: string;
  entity: string;
  entityId?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  at?: string;
};

let indexesReady = false;

async function ensureIndexes(db: Db): Promise<void> {
  if (indexesReady) return;
  await db.collection(OPS_AUDIT_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(OPS_AUDIT_COLLECTION).createIndex({ at: -1 });
  await db.collection(OPS_AUDIT_COLLECTION).createIndex({ entity: 1, entityId: 1, at: -1 });
  await db.collection(OPS_AUDIT_COLLECTION).createIndex({ actorId: 1, at: -1 });
  indexesReady = true;
}

/**
 * Append-only audit log. This module intentionally has no update or delete.
 * Corrections are new events. Existing rows are not rewritten.
 */
export async function appendOpsAudit(db: Db, input: OpsAuditInput): Promise<OpsAuditEvent> {
  await ensureIndexes(db);
  const event: OpsAuditEvent = {
    id: uuidv4(),
    actorId: input.actorId,
    actorEmail: input.actorEmail || '',
    action: input.action,
    entity: input.entity,
    entityId: input.entityId || '',
    before: input.before ?? null,
    after: input.after ?? null,
    at: input.at || new Date().toISOString(),
  };
  await db.collection(OPS_AUDIT_COLLECTION).insertOne({ ...event });
  return event;
}

export async function listOpsAudit(
  db: Db,
  options: { entity?: string; entityId?: string; limit?: number } = {},
): Promise<OpsAuditEvent[]> {
  const query: Record<string, unknown> = {};
  if (options.entity) query.entity = options.entity;
  if (options.entityId) query.entityId = options.entityId;
  const limit = Math.min(200, Math.max(1, options.limit || 50));
  const rows = await db.collection(OPS_AUDIT_COLLECTION)
    .find(query, { projection: { _id: 0 } })
    .sort({ at: -1 })
    .limit(limit)
    .toArray();
  return rows as unknown as OpsAuditEvent[];
}
