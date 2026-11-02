import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { ProjectValidationError } from '@/lib/ops/projects/errors';
import { toPhoneE164 } from '@/lib/ops/outreach/store';
import { maskName, maskPhone } from '@/lib/ops/portfolio/mask';
import { PORTFOLIO_COLLECTION, type PortfolioFlat, type PortfolioOwner, type PublicPortfolioOwner } from '@/lib/ops/portfolio/types';

const ensured = new WeakSet<object>();

function text(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function bool(value: unknown, fallback = false): boolean {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  const raw = text(value).toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

function flatsOf(value: unknown): PortfolioFlat[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const flat = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return { project: text(flat.project), tower: text(flat.tower), floor: text(flat.floor), flat: text(flat.flat) };
  }).filter((flat) => flat.project || flat.flat);
}

export function asPortfolioOwner(doc: Record<string, unknown>): PortfolioOwner {
  const flats = flatsOf(doc.flats);
  const projects = Array.isArray(doc.projects) && doc.projects.length
    ? doc.projects.map((item) => String(item).trim()).filter(Boolean)
    : [...new Set(flats.map((flat) => flat.project).filter(Boolean))];
  return {
    id: text(doc.id),
    name: text(doc.name),
    phone_e164: text(doc.phone_e164),
    email: text(doc.email),
    priority: text(doc.priority),
    nri: bool(doc.nri),
    company: bool(doc.company),
    broker: bool(doc.broker),
    suspected_broker: bool(doc.suspected_broker),
    projects,
    flats,
    notes: text(doc.notes),
    status: text(doc.status) || 'active',
    createdAt: text(doc.createdAt),
    updatedAt: text(doc.updatedAt),
    lastUpdatedBy: text(doc.lastUpdatedBy),
  };
}

export function presentPortfolioOwner(owner: PortfolioOwner, canSeePrivate: boolean): PortfolioOwner | PublicPortfolioOwner {
  if (canSeePrivate) return owner;
  const masked = {
    ...owner,
    name: maskName(owner.name),
    phone_masked: maskPhone(owner.phone_e164),
    email: owner.email ? '•••' : '',
  };
  delete (masked as { phone_e164?: string }).phone_e164;
  return masked;
}

export async function ensurePortfolioIndexes(db: Db): Promise<void> {
  if (ensured.has(db)) return;
  const col = db.collection(PORTFOLIO_COLLECTION);
  await col.createIndex({ id: 1 }, { unique: true });
  await col.createIndex({ phone_e164: 1 }, { unique: true });
  ensured.add(db);
}

export async function listPortfolio(db: Db): Promise<PortfolioOwner[]> {
  await ensurePortfolioIndexes(db);
  const docs = await db.collection(PORTFOLIO_COLLECTION).find({}).toArray();
  return docs.map((doc) => asPortfolioOwner(doc as Record<string, unknown>)).filter((owner) => owner.flats.length >= 2);
}

export async function savePortfolio(db: Db, patch: Record<string, unknown>, actor: string): Promise<{ owner: PortfolioOwner; created: boolean }> {
  await ensurePortfolioIndexes(db);
  const phone = toPhoneE164(patch.phone_e164);
  if (!phone) throw new ProjectValidationError('A valid phone number is required.');
  const now = new Date().toISOString();
  const existing = patch.id
    ? await db.collection(PORTFOLIO_COLLECTION).findOne({ id: text(patch.id) })
    : await db.collection(PORTFOLIO_COLLECTION).findOne({ phone_e164: phone });
  const previous = existing ? asPortfolioOwner(existing as Record<string, unknown>) : null;
  const flats = patch.flats != null ? flatsOf(patch.flats) : previous?.flats || [];
  if (!previous && flats.length < 2) throw new ProjectValidationError('A portfolio owner needs at least two flats.');
  const owner: PortfolioOwner = {
    id: previous?.id || randomUUID(),
    name: text(patch.name ?? previous?.name),
    phone_e164: phone,
    email: text(patch.email ?? previous?.email),
    priority: text(patch.priority ?? previous?.priority),
    nri: patch.nri != null ? bool(patch.nri) : previous?.nri || false,
    company: patch.company != null ? bool(patch.company) : previous?.company || false,
    broker: patch.broker != null ? bool(patch.broker) : previous?.broker || false,
    suspected_broker: patch.suspected_broker != null ? bool(patch.suspected_broker) : previous?.suspected_broker || false,
    projects: [...new Set(flats.map((flat) => flat.project).filter(Boolean))],
    flats,
    notes: patch.notes != null ? text(patch.notes) : previous?.notes || '',
    status: text(patch.status ?? previous?.status) || 'active',
    createdAt: previous?.createdAt || now,
    updatedAt: now,
    lastUpdatedBy: actor,
  };
  if (!previous && !owner.name) throw new ProjectValidationError('A name is required.');
  if (previous) await db.collection(PORTFOLIO_COLLECTION).updateOne({ id: previous.id }, { $set: owner });
  else await db.collection(PORTFOLIO_COLLECTION).insertOne(owner);
  return { owner, created: !previous };
}

export async function getPortfolioDb(): Promise<Db> {
  return getDb() as Promise<Db>;
}
