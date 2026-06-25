import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
// @ts-expect-error JS module without types
import { getDb } from '@/lib/mongodb';
import { isValidIndianMobile, normalizeIndianMobile } from '@/lib/phone/indian-mobile';
import { PAINTING_LEAD_SOURCE } from './constants';
import type { PaintingLead, PaintingLeadStatus } from './types';

const COLLECTION = 'painting_leads';

export async function getPaintingDatabase(): Promise<Db> {
  return getDb();
}

export async function ensurePaintingLeadIndexes(db: Db): Promise<void> {
  await db.collection(COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ createdAt: -1 });
  await db.collection(COLLECTION).createIndex({ status: 1 });
  await db.collection(COLLECTION).createIndex({ mobile: 1 });
  await db.collection(COLLECTION).createIndex({ location: 1 });
}

export function normalizePaintingMobile(mobile: string): string {
  return normalizeIndianMobile(mobile);
}

export function isValidPaintingMobile(mobile: string): boolean {
  return isValidIndianMobile(mobile);
}

export async function findRecentPaintingLeadByMobile(
  db: Db,
  mobile: string,
  withinMinutes = 30,
): Promise<PaintingLead | null> {
  const digits = normalizePaintingMobile(mobile);
  if (!digits) return null;
  const since = new Date(Date.now() - withinMinutes * 60 * 1000).toISOString();
  const leads = (await db
    .collection(COLLECTION)
    .find({ createdAt: { $gte: since }, mobile: { $regex: digits } }, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray()) as PaintingLead[];
  return leads[0] || null;
}

export async function createPaintingLead(
  db: Db,
  payload: {
    name: string;
    mobile: string;
    location: string;
    email?: string;
    propertyType?: string;
    apartmentSize?: string;
    requirement?: string;
    visitDate?: string;
    budget?: string;
    message?: string;
    leadSource?: string;
  },
): Promise<PaintingLead> {
  const now = new Date().toISOString();
  const lead: PaintingLead = {
    id: uuidv4(),
    name: payload.name.trim(),
    mobile: payload.mobile,
    email: payload.email?.trim() || '',
    location: payload.location.trim(),
    propertyType: payload.propertyType?.trim() || '',
    apartmentSize: payload.apartmentSize?.trim() || '',
    requirement: payload.requirement?.trim() || '',
    visitDate: payload.visitDate?.trim() || '',
    budget: payload.budget?.trim() || '',
    message: payload.message?.trim() || '',
    leadSource: payload.leadSource || PAINTING_LEAD_SOURCE,
    status: 'new',
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(COLLECTION).insertOne(lead);
  return lead;
}

export async function getPaintingLeadById(db: Db, id: string): Promise<PaintingLead | null> {
  return db
    .collection(COLLECTION)
    .findOne({ id }, { projection: { _id: 0 } }) as Promise<PaintingLead | null>;
}

export async function listPaintingLeads(
  db: Db,
  filters: { q?: string; status?: PaintingLeadStatus } = {},
  limit = 500,
): Promise<PaintingLead[]> {
  const query: Record<string, unknown> = {};
  if (filters.status) query.status = filters.status;

  let leads = (await db
    .collection(COLLECTION)
    .find(query, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray()) as PaintingLead[];

  const q = filters.q?.trim().toLowerCase();
  if (q) {
    leads = leads.filter((lead) => {
      const haystack = [
        lead.name,
        lead.mobile,
        lead.email,
        lead.location,
        lead.propertyType,
        lead.requirement,
        lead.message,
        lead.leadSource,
        lead.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  return leads;
}

export async function updatePaintingLead(
  db: Db,
  id: string,
  patch: { status?: PaintingLeadStatus; notes?: string },
): Promise<PaintingLead | null> {
  const existing = await getPaintingLeadById(db, id);
  if (!existing) return null;

  const update: Record<string, string> = { updatedAt: new Date().toISOString() };
  if (patch.status) update.status = patch.status;
  if (typeof patch.notes === 'string') update.notes = patch.notes;

  await db.collection(COLLECTION).updateOne({ id }, { $set: update });
  return getPaintingLeadById(db, id);
}

export async function deletePaintingLead(db: Db, id: string): Promise<boolean> {
  const result = await db.collection(COLLECTION).deleteOne({ id });
  return result.deletedCount > 0;
}

export function paintingLeadsToCsv(leads: PaintingLead[]): string {
  const headers = [
    'ID',
    'Name',
    'Mobile',
    'Email',
    'Location',
    'Property Type',
    'Apartment Size',
    'Requirement',
    'Visit Date',
    'Budget',
    'Message',
    'Lead Source',
    'Status',
    'Notes',
    'Created At',
  ];
  const rows = leads.map((lead) => [
    lead.id,
    lead.name,
    lead.mobile,
    lead.email,
    lead.location,
    lead.propertyType,
    lead.apartmentSize,
    lead.requirement,
    lead.visitDate,
    lead.budget,
    (lead.message || '').replace(/"/g, '""'),
    lead.leadSource,
    lead.status,
    (lead.notes || '').replace(/"/g, '""'),
    lead.createdAt,
  ]);
  return [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
}
