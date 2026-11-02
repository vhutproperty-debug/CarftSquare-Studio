import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { ProjectValidationError } from '@/lib/ops/projects/errors';
import { toPhoneE164 } from '@/lib/ops/outreach/store';
import { RERENT_COLLECTION, RERENT_STATUSES, type RerentHistoryEntry, type RerentLease, type RerentStatus } from '@/lib/ops/rerent/types';

const ensured = new WeakSet<object>();

function text(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function statusOf(value: unknown): RerentStatus {
  const status = text(value);
  return (RERENT_STATUSES as readonly string[]).includes(status) ? status as RerentStatus : 'not_contacted';
}

function historyOf(value: unknown): RerentHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const entry = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return {
      id: text(entry.id) || randomUUID(),
      at: text(entry.at),
      by: text(entry.by),
      kind: text(entry.kind) === 'note' ? 'note' as const : 'status' as const,
      note: text(entry.note),
    };
  });
}

export function asRerentLease(doc: Record<string, unknown>): RerentLease {
  return {
    id: text(doc.id),
    project: text(doc.project),
    tower: text(doc.tower),
    floor: text(doc.floor),
    flat: text(doc.flat),
    name: text(doc.name),
    role: text(doc.role) === 'owner' ? 'owner' : 'tenant',
    phone_e164: text(doc.phone_e164),
    email: text(doc.email),
    lease_end: text(doc.lease_end),
    status: statusOf(doc.status),
    remarks: text(doc.remarks),
    history: historyOf(doc.history),
    createdAt: text(doc.createdAt),
    updatedAt: text(doc.updatedAt),
    lastUpdatedBy: text(doc.lastUpdatedBy),
  };
}

export async function ensureRerentIndexes(db: Db): Promise<void> {
  if (ensured.has(db)) return;
  const col = db.collection(RERENT_COLLECTION);
  await col.createIndex({ id: 1 }, { unique: true });
  await col.createIndex({ phone_e164: 1, project: 1, flat: 1 }, { unique: true });
  await col.createIndex({ lease_end: 1, status: 1 });
  ensured.add(db);
}

export async function listRerent(db: Db): Promise<RerentLease[]> {
  await ensureRerentIndexes(db);
  const docs = await db.collection(RERENT_COLLECTION).find({}).toArray();
  return docs.map((doc) => asRerentLease(doc as Record<string, unknown>));
}

export async function saveRerent(db: Db, patch: Record<string, unknown>, actor: string): Promise<{ lease: RerentLease; created: boolean }> {
  await ensureRerentIndexes(db);
  const phone = toPhoneE164(patch.phone_e164);
  if (!phone) throw new ProjectValidationError('A valid phone number is required.');
  const project = text(patch.project);
  const flat = text(patch.flat);
  if (!project) throw new ProjectValidationError('A project is required.');
  const now = new Date().toISOString();
  const existing = patch.id
    ? await db.collection(RERENT_COLLECTION).findOne({ id: text(patch.id) })
    : await db.collection(RERENT_COLLECTION).findOne({ phone_e164: phone, project, flat });
  const previous = existing ? asRerentLease(existing as Record<string, unknown>) : null;
  const history = previous ? [...previous.history] : [];
  const nextStatus = patch.status ? statusOf(patch.status) : previous?.status || 'not_contacted';
  if (previous && nextStatus !== previous.status) {
    history.push({ id: randomUUID(), at: now, by: actor, kind: 'status', note: `${previous.status} → ${nextStatus}` });
  }
  if (typeof patch.note === 'string' && patch.note.trim()) {
    history.push({ id: randomUUID(), at: now, by: actor, kind: 'note', note: patch.note.trim().slice(0, 2000) });
  }
  const lease: RerentLease = {
    id: previous?.id || randomUUID(),
    project: project || previous?.project || '',
    tower: text(patch.tower ?? previous?.tower),
    floor: text(patch.floor ?? previous?.floor),
    flat: flat || previous?.flat || '',
    name: text(patch.name ?? previous?.name),
    role: text(patch.role) === 'owner' ? 'owner' : previous?.role || 'tenant',
    phone_e164: phone,
    email: text(patch.email ?? previous?.email),
    lease_end: text(patch.lease_end ?? previous?.lease_end),
    status: nextStatus,
    remarks: patch.remarks != null ? text(patch.remarks) : previous?.remarks || '',
    history,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
    lastUpdatedBy: actor,
  };
  if (!previous && !lease.name) throw new ProjectValidationError('A name is required.');
  if (previous) await db.collection(RERENT_COLLECTION).updateOne({ id: previous.id }, { $set: lease });
  else await db.collection(RERENT_COLLECTION).insertOne(lease);
  return { lease, created: !previous };
}

export async function getRerentDb(): Promise<Db> {
  return getDb() as Promise<Db>;
}
