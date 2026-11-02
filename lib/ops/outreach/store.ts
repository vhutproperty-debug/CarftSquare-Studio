import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { ProjectValidationError } from '@/lib/ops/projects/errors';
import { normalizeOutreachPhone } from '@/lib/ops/outreach-phone';
import {
  OUTREACH_APPROVALS_COLLECTION,
  OUTREACH_AUDIENCES,
  OUTREACH_COLLECTION,
  OUTREACH_ROLES,
  OUTREACH_STATUSES,
  OUTREACH_TEMPLATES_COLLECTION,
  type OutreachApproval,
  type OutreachAudience,
  type OutreachContact,
  type OutreachHistoryEntry,
  type OutreachRole,
  type OutreachStatus,
  type OutreachTemplate,
} from '@/lib/ops/outreach/types';

const ensured = new WeakSet<object>();

export function toPhoneE164(value: unknown): string | null {
  const phone = normalizeOutreachPhone(value);
  if (!phone) return null;
  return phone.kind === 'indian' ? `+91${phone.phone}` : phone.phone;
}

export async function getOutreachDatabase(): Promise<Db> {
  return getDb() as Promise<Db>;
}

export async function ensureOutreachIndexes(db: Db): Promise<void> {
  if (ensured.has(db)) return;
  await db.collection(OUTREACH_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(OUTREACH_COLLECTION).createIndex({ phone_e164: 1, audience: 1 }, { unique: true });
  await db.collection(OUTREACH_COLLECTION).createIndex({ audience: 1, wave: 1, status: 1 });
  await db.collection(OUTREACH_TEMPLATES_COLLECTION).createIndex({ audience: 1 }, { unique: true });
  await db.collection(OUTREACH_APPROVALS_COLLECTION).createIndex({ id: 1 }, { unique: true });
  ensured.add(db);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function audienceOf(value: unknown): OutreachAudience {
  const audience = text(value);
  return (OUTREACH_AUDIENCES as readonly string[]).includes(audience) ? audience as OutreachAudience : 'owner_sell';
}

function statusOf(value: unknown): OutreachStatus {
  const status = text(value);
  return (OUTREACH_STATUSES as readonly string[]).includes(status) ? status as OutreachStatus : 'not_contacted';
}

function roleOf(value: unknown): OutreachRole {
  return text(value) === 'tenant' ? 'tenant' : 'owner';
}

function historyOf(value: unknown): OutreachHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const entry = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const kind = text(entry.kind);
    return {
      id: text(entry.id) || randomUUID(),
      at: text(entry.at),
      by: text(entry.by),
      kind: kind === 'note' || kind === 'approval' ? kind : 'status',
      fromStatus: text(entry.fromStatus),
      toStatus: text(entry.toStatus),
      note: text(entry.note),
    };
  });
}

export function asOutreachContact(doc: Record<string, unknown>): OutreachContact {
  return {
    id: text(doc.id),
    audience: audienceOf(doc.audience),
    wave: text(doc.wave),
    priority: text(doc.priority),
    project: text(doc.project),
    tower: text(doc.tower),
    floor: text(doc.floor),
    bhk: text(doc.bhk),
    flats: Array.isArray(doc.flats) ? doc.flats.map((item) => String(item || '').trim()).filter(Boolean) : [],
    name: text(doc.name),
    role: roleOf(doc.role),
    phone_e164: text(doc.phone_e164),
    email: text(doc.email),
    signal: text(doc.signal),
    lease_end: text(doc.lease_end),
    already_contacted: doc.already_contacted === true || text(doc.already_contacted).toLowerCase() === 'true' || text(doc.already_contacted) === '1',
    status: statusOf(doc.status),
    notes: text(doc.notes),
    message: text(doc.message),
    history: historyOf(doc.history),
    createdAt: text(doc.createdAt),
    updatedAt: text(doc.updatedAt),
    lastUpdatedBy: text(doc.lastUpdatedBy),
  };
}

export async function listOutreach(db: Db): Promise<OutreachContact[]> {
  await ensureOutreachIndexes(db);
  const docs = await db.collection(OUTREACH_COLLECTION).find({}).toArray();
  return docs.map((doc) => asOutreachContact(doc as Record<string, unknown>));
}

export async function getOutreach(db: Db, idOrKey: { id?: string; phone_e164?: string; audience?: string }): Promise<OutreachContact | null> {
  await ensureOutreachIndexes(db);
  const query = idOrKey.id
    ? { id: idOrKey.id }
    : { phone_e164: idOrKey.phone_e164, audience: idOrKey.audience };
  const doc = await db.collection(OUTREACH_COLLECTION).findOne(query);
  return doc ? asOutreachContact(doc as Record<string, unknown>) : null;
}

export async function saveOutreach(
  db: Db,
  patch: Record<string, unknown>,
  actor: string,
): Promise<{ contact: OutreachContact; created: boolean }> {
  await ensureOutreachIndexes(db);
  const phone = toPhoneE164(patch.phone_e164);
  const audience = audienceOf(patch.audience);
  if (!phone) throw new ProjectValidationError('A valid phone number is required.');
  const now = new Date().toISOString();
  const existing = await db.collection(OUTREACH_COLLECTION).findOne({ phone_e164: phone, audience });
  const previous = existing ? asOutreachContact(existing as Record<string, unknown>) : null;
  const history = previous ? [...previous.history] : [];
  const nextStatus = patch.status ? statusOf(patch.status) : previous?.status || 'not_contacted';
  if (previous && nextStatus !== previous.status) {
    history.push({ id: randomUUID(), at: now, by: actor, kind: 'status', fromStatus: previous.status, toStatus: nextStatus, note: '' });
  }
  if (typeof patch.note === 'string' && patch.note.trim()) {
    history.push({ id: randomUUID(), at: now, by: actor, kind: 'note', note: patch.note.trim().slice(0, 2000) });
  }
  const record: OutreachContact = {
    id: previous?.id || randomUUID(),
    audience,
    wave: text(patch.wave ?? previous?.wave),
    priority: text(patch.priority ?? previous?.priority),
    project: text(patch.project ?? previous?.project),
    tower: text(patch.tower ?? previous?.tower),
    floor: text(patch.floor ?? previous?.floor),
    bhk: text(patch.bhk ?? previous?.bhk),
    flats: Array.isArray(patch.flats) ? patch.flats.map((item) => String(item).trim()).filter(Boolean) : previous?.flats || [],
    name: text(patch.name ?? previous?.name),
    role: patch.role ? roleOf(patch.role) : previous?.role || 'owner',
    phone_e164: phone,
    email: text(patch.email ?? previous?.email),
    signal: text(patch.signal ?? previous?.signal),
    lease_end: text(patch.lease_end ?? previous?.lease_end),
    already_contacted: patch.already_contacted != null ? Boolean(patch.already_contacted) : previous?.already_contacted || false,
    status: nextStatus,
    notes: patch.notes != null ? text(patch.notes) : previous?.notes || '',
    message: patch.message != null ? text(patch.message) : previous?.message || '',
    history,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
    lastUpdatedBy: actor,
  };
  if (!previous && !record.name) throw new ProjectValidationError('A name is required to add a contact.');
  if (previous) await db.collection(OUTREACH_COLLECTION).updateOne({ id: previous.id }, { $set: record });
  else await db.collection(OUTREACH_COLLECTION).insertOne(record);
  return { contact: record, created: !previous };
}

export async function listTemplates(db: Db): Promise<OutreachTemplate[]> {
  await ensureOutreachIndexes(db);
  const docs = await db.collection(OUTREACH_TEMPLATES_COLLECTION).find({}).toArray();
  return docs.map((doc) => ({
    audience: audienceOf((doc as Record<string, unknown>).audience),
    body: text((doc as Record<string, unknown>).body),
    updatedAt: text((doc as Record<string, unknown>).updatedAt),
    updatedBy: text((doc as Record<string, unknown>).updatedBy),
  }));
}

export async function saveTemplate(db: Db, audience: OutreachAudience, body: string, actor: string): Promise<OutreachTemplate> {
  await ensureOutreachIndexes(db);
  const template = { audience, body: body.slice(0, 2000), updatedAt: new Date().toISOString(), updatedBy: actor };
  const existing = await db.collection(OUTREACH_TEMPLATES_COLLECTION).findOne({ audience });
  if (existing) await db.collection(OUTREACH_TEMPLATES_COLLECTION).updateOne({ audience }, { $set: template });
  else await db.collection(OUTREACH_TEMPLATES_COLLECTION).insertOne(template);
  return template;
}

export async function approveWave(db: Db, input: { wave: string; audience: OutreachAudience | ''; note: string }, actor: string): Promise<OutreachApproval> {
  await ensureOutreachIndexes(db);
  if (!input.wave.trim()) throw new ProjectValidationError('Choose a wave to approve.');
  const approval: OutreachApproval = {
    id: randomUUID(),
    audience: input.audience,
    wave: input.wave.trim(),
    approvedBy: actor,
    approvedAt: new Date().toISOString(),
    note: input.note.slice(0, 500),
  };
  await db.collection(OUTREACH_APPROVALS_COLLECTION).insertOne(approval);
  return approval;
}

export async function listApprovals(db: Db): Promise<OutreachApproval[]> {
  await ensureOutreachIndexes(db);
  const docs = await db.collection(OUTREACH_APPROVALS_COLLECTION).find({}).toArray();
  return docs.map((doc) => ({
    id: text((doc as Record<string, unknown>).id),
    audience: text((doc as Record<string, unknown>).audience) as OutreachAudience | '',
    wave: text((doc as Record<string, unknown>).wave),
    approvedBy: text((doc as Record<string, unknown>).approvedBy),
    approvedAt: text((doc as Record<string, unknown>).approvedAt),
    note: text((doc as Record<string, unknown>).note),
  }));
}
