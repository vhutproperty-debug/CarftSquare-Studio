import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { ProjectValidationError } from '@/lib/ops/projects/errors';
import { toPhoneE164 } from '@/lib/ops/outreach/store';
import {
  LEASE_CALL_STATUSES,
  LEASE_EXPIRIES_COLLECTION,
  normalizeLeaseDate,
  type LeaseCallStatus,
  type LeaseExpiry,
  type LeaseHistoryEntry,
} from '@/lib/ops/lease-expiries/types';

const ensured = new WeakSet<object>();

function text(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function statusOf(value: unknown): LeaseCallStatus {
  const status = text(value);
  return (LEASE_CALL_STATUSES as readonly string[]).includes(status) ? status as LeaseCallStatus : 'not_called';
}

function historyOf(value: unknown): LeaseHistoryEntry[] {
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

export function leaseKey(project: string, tower: string, flat: string): string {
  return [project, tower, flat].map((part) => part.trim().toLowerCase()).join('|');
}

export function asLeaseExpiry(doc: Record<string, unknown>): LeaseExpiry {
  return {
    id: text(doc.id),
    project: text(doc.project),
    tower: text(doc.tower),
    flat: text(doc.flat),
    ownerName: text(doc.ownerName),
    ownerPhone: text(doc.ownerPhone),
    tenantName: text(doc.tenantName),
    tenantPhone: text(doc.tenantPhone),
    leaseStart: normalizeLeaseDate(text(doc.leaseStart)),
    leaseEnd: normalizeLeaseDate(text(doc.leaseEnd)),
    priority: text(doc.priority),
    status: statusOf(doc.status),
    notes: text(doc.notes),
    history: historyOf(doc.history),
    createdAt: text(doc.createdAt),
    updatedAt: text(doc.updatedAt),
    lastUpdatedBy: text(doc.lastUpdatedBy),
  };
}

function phoneOrEmpty(value: unknown): string {
  const raw = text(value).trim();
  if (!raw) return '';
  return toPhoneE164(raw) || '';
}

export async function ensureLeaseIndexes(db: Db): Promise<void> {
  if (ensured.has(db)) return;
  const col = db.collection(LEASE_EXPIRIES_COLLECTION);
  await col.createIndex({ id: 1 }, { unique: true });
  await col.createIndex({ dedupeKey: 1 }, { unique: true });
  await col.createIndex({ project: 1, leaseEnd: 1 });
  ensured.add(db);
}

export async function getLeaseDatabase(): Promise<Db> {
  return getDb() as Promise<Db>;
}

export async function listLeaseExpiries(db: Db): Promise<LeaseExpiry[]> {
  await ensureLeaseIndexes(db);
  const docs = await db.collection(LEASE_EXPIRIES_COLLECTION).find({}).toArray();
  return docs.map((doc) => asLeaseExpiry(doc as Record<string, unknown>));
}

export async function saveLeaseExpiry(db: Db, patch: Record<string, unknown>, actor: string): Promise<{ lease: LeaseExpiry; created: boolean }> {
  await ensureLeaseIndexes(db);
  const project = text(patch.project).trim();
  const tower = text(patch.tower).trim();
  const flat = text(patch.flat).trim();
  if (!project || !flat) throw new ProjectValidationError('Project and flat are required.');
  const dedupeKey = leaseKey(project, tower, flat);
  const now = new Date().toISOString();
  const existing = patch.id
    ? await db.collection(LEASE_EXPIRIES_COLLECTION).findOne({ id: text(patch.id) })
    : await db.collection(LEASE_EXPIRIES_COLLECTION).findOne({ dedupeKey });
  const previous = existing ? asLeaseExpiry(existing as Record<string, unknown>) : null;
  const history = previous ? [...previous.history] : [];
  const nextStatus = patch.status ? statusOf(patch.status) : previous?.status || 'not_called';
  if (previous && nextStatus !== previous.status) {
    history.push({ id: randomUUID(), at: now, by: actor, kind: 'status', note: `${previous.status} → ${nextStatus}` });
  }
  if (typeof patch.note === 'string' && patch.note.trim()) {
    history.push({ id: randomUUID(), at: now, by: actor, kind: 'note', note: patch.note.trim().slice(0, 2000) });
  }
  const ownerPhone = patch.ownerPhone != null ? phoneOrEmpty(patch.ownerPhone) : previous?.ownerPhone || '';
  const tenantPhone = patch.tenantPhone != null ? phoneOrEmpty(patch.tenantPhone) : previous?.tenantPhone || '';
  if (text(patch.ownerPhone).trim() && !ownerPhone) throw new ProjectValidationError('Owner phone is not a valid number.');
  if (text(patch.tenantPhone).trim() && !tenantPhone) throw new ProjectValidationError('Tenant phone is not a valid number.');
  const lease: LeaseExpiry & { dedupeKey: string } = {
    id: previous?.id || randomUUID(),
    dedupeKey,
    project,
    tower,
    flat,
    ownerName: text(patch.ownerName ?? previous?.ownerName),
    ownerPhone,
    tenantName: text(patch.tenantName ?? previous?.tenantName),
    tenantPhone,
    leaseStart: normalizeLeaseDate(text(patch.leaseStart ?? previous?.leaseStart)),
    leaseEnd: normalizeLeaseDate(text(patch.leaseEnd ?? previous?.leaseEnd)),
    priority: text(patch.priority ?? previous?.priority),
    status: nextStatus,
    notes: patch.notes != null ? text(patch.notes) : previous?.notes || '',
    history,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
    lastUpdatedBy: actor,
  };
  if (previous) await db.collection(LEASE_EXPIRIES_COLLECTION).updateOne({ id: previous.id }, { $set: lease });
  else await db.collection(LEASE_EXPIRIES_COLLECTION).insertOne(lease);
  const { dedupeKey: _key, ...saved } = lease;
  return { lease: saved, created: !previous };
}
