import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
// @ts-expect-error JS module without types
import { getDb } from '@/lib/mongodb';
import type { DesignerCallbackLead, DesignerLeadStatus } from './types';

const COLLECTION = 'designer_callback_leads';

export async function getDatabase(): Promise<Db> {
  return getDb();
}

export async function ensureDesignerLeadIndexes(db: Db): Promise<void> {
  await db.collection(COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ createdAt: -1 });
  await db.collection(COLLECTION).createIndex({ status: 1 });
  await db.collection(COLLECTION).createIndex({ phone: 1 });
  await db.collection(COLLECTION).createIndex({ name: 1 });
  await db.collection(COLLECTION).createIndex({ city: 1 });
  await db.collection(COLLECTION).createIndex({ projectType: 1 });
}

export function normalizeDesignerPhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}

export function isValidDesignerPhone(phone: string): boolean {
  const digits = normalizeDesignerPhone(phone);
  return /^[6-9]\d{9}$/.test(digits);
}

export async function findRecentDesignerLeadByPhone(
  db: Db,
  phone: string,
  withinMinutes = 30,
): Promise<DesignerCallbackLead | null> {
  const digits = normalizeDesignerPhone(phone);
  if (!digits) return null;
  const since = new Date(Date.now() - withinMinutes * 60 * 1000).toISOString();
  const leads = (await db
    .collection(COLLECTION)
    .find({ createdAt: { $gte: since }, phone: { $regex: digits } }, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray()) as DesignerCallbackLead[];
  return leads[0] || null;
}

export async function createDesignerCallbackLead(
  db: Db,
  payload: Omit<DesignerCallbackLead, 'id' | 'source' | 'status' | 'notes' | 'createdAt' | 'updatedAt'>,
): Promise<DesignerCallbackLead> {
  const now = new Date().toISOString();
  const lead: DesignerCallbackLead = {
    ...payload,
    id: uuidv4(),
    source: 'Human Designer Request',
    status: 'new',
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(COLLECTION).insertOne(lead);
  return lead;
}

export async function getDesignerLeadById(db: Db, id: string): Promise<DesignerCallbackLead | null> {
  return db
    .collection(COLLECTION)
    .findOne({ id }, { projection: { _id: 0 } }) as Promise<DesignerCallbackLead | null>;
}

export async function listDesignerLeads(
  db: Db,
  filters: { q?: string; status?: DesignerLeadStatus; projectType?: string } = {},
  limit = 500,
): Promise<DesignerCallbackLead[]> {
  const query: Record<string, unknown> = {};
  if (filters.status) query.status = filters.status;
  if (filters.projectType) query.projectType = filters.projectType;

  let leads = (await db
    .collection(COLLECTION)
    .find(query, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray()) as DesignerCallbackLead[];

  const q = filters.q?.trim().toLowerCase();
  if (q) {
    leads = leads.filter((lead) => {
      const haystack = [lead.name, lead.phone, lead.city, lead.projectType, lead.message, lead.landingPage]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  return leads;
}

export function designerLeadsToCsv(leads: DesignerCallbackLead[]): string {
  const headers = ['ID', 'Name', 'Phone', 'City', 'Project Type', 'Message', 'Source', 'Status', 'Landing Page', 'Notes', 'Created At'];
  const rows = leads.map((lead) => [
    lead.id,
    lead.name,
    lead.phone,
    lead.city,
    lead.projectType,
    lead.message.replace(/"/g, '""'),
    lead.source,
    lead.status,
    lead.landingPage,
    (lead.notes || '').replace(/"/g, '""'),
    lead.createdAt,
  ]);
  return [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
}
