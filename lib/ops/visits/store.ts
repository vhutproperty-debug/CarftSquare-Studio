import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
// @ts-expect-error JS module without types
import { getDb } from '@/lib/mongodb';
import { stampCreate, stampUpdate } from '@/lib/ops/os/records';

export const SITE_VISITS_COLLECTION = 'ops_site_visits';

export type SiteVisitStatus = 'scheduled' | 'completed' | 'cancelled';

export type SiteVisit = {
  id: string;
  dealId: string;
  scheduledAt: string;
  status: SiteVisitStatus;
  notes: string;
  assignedTo: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

let indexesReady = false;

async function ensureIndexes(db: Db): Promise<void> {
  if (indexesReady) return;
  await db.collection(SITE_VISITS_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(SITE_VISITS_COLLECTION).createIndex({ dealId: 1, scheduledAt: 1 });
  indexesReady = true;
}

export async function getVisitsDb(): Promise<Db> {
  return getDb();
}

export async function listSiteVisits(db: Db): Promise<SiteVisit[]> {
  await ensureIndexes(db);
  const rows = await db.collection(SITE_VISITS_COLLECTION).find({}).sort({ scheduledAt: 1 }).toArray();
  return (rows as unknown as SiteVisit[]).filter((row) => !row.deletedAt);
}

export async function scheduleSiteVisit(
  db: Db,
  input: { dealId: string; scheduledAt: string; notes?: string; assignedTo?: string },
  actorId: string,
): Promise<SiteVisit> {
  await ensureIndexes(db);
  const dealId = input.dealId.trim();
  const scheduledAt = input.scheduledAt.trim();
  if (!dealId || !scheduledAt) throw new Error('A deal and a visit time are required.');
  const doc: SiteVisit = {
    id: uuidv4(),
    dealId,
    scheduledAt,
    status: 'scheduled',
    notes: input.notes?.trim() || '',
    assignedTo: input.assignedTo?.trim() || actorId,
    ...stampCreate({ id: actorId }),
  };
  await db.collection(SITE_VISITS_COLLECTION).insertOne({ ...doc });
  return doc;
}

export async function updateSiteVisitStatus(
  db: Db,
  id: string,
  status: SiteVisitStatus,
  actorId: string,
): Promise<SiteVisit | null> {
  await ensureIndexes(db);
  if (status !== 'scheduled' && status !== 'completed' && status !== 'cancelled') {
    throw new Error('Status must be scheduled, completed, or cancelled.');
  }
  const current = await db.collection(SITE_VISITS_COLLECTION).findOne({ id }) as SiteVisit | null;
  if (!current || current.deletedAt) return null;
  const next: SiteVisit = { ...current, status, ...stampUpdate({ id: actorId }), createdAt: current.createdAt, createdBy: current.createdBy };
  const stored = { ...next } as SiteVisit & { _id?: unknown };
  delete stored._id;
  await db.collection(SITE_VISITS_COLLECTION).updateOne({ id }, { $set: stored });
  return next;
}
