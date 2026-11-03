import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
// @ts-expect-error JS module without types
import { getDb } from '@/lib/mongodb';
import { stampCreate, stampUpdate } from '@/lib/ops/os/records';

export const INTERIOR_COLLECTION = 'ops_interior_projects';

export const INTERIOR_STAGES = ['enquiry', 'site_measure', 'design', 'execution', 'handed_over'] as const;
export type InteriorStage = (typeof INTERIOR_STAGES)[number];

export type InteriorProject = {
  id: string;
  title: string;
  clientName: string;
  phone: string;
  stage: InteriorStage;
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
  await db.collection(INTERIOR_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(INTERIOR_COLLECTION).createIndex({ assignedTo: 1, stage: 1 });
  indexesReady = true;
}

export async function getInteriorDb(): Promise<Db> {
  return getDb();
}

export async function listInteriorProjects(db: Db): Promise<InteriorProject[]> {
  await ensureIndexes(db);
  const rows = await db.collection(INTERIOR_COLLECTION).find({}).sort({ updatedAt: -1 }).toArray();
  return (rows as unknown as InteriorProject[]).filter((row) => !row.deletedAt);
}

export async function createInteriorProject(
  db: Db,
  input: { title: string; clientName?: string; phone?: string; notes?: string; assignedTo?: string },
  actorId: string,
): Promise<InteriorProject> {
  await ensureIndexes(db);
  const title = input.title.trim();
  if (!title) throw new Error('A project title is required.');
  const doc: InteriorProject = {
    id: uuidv4(),
    title,
    clientName: input.clientName?.trim() || '',
    phone: input.phone?.trim() || '',
    stage: 'enquiry',
    notes: input.notes?.trim() || '',
    assignedTo: input.assignedTo?.trim() || actorId,
    ...stampCreate({ id: actorId }),
  };
  await db.collection(INTERIOR_COLLECTION).insertOne({ ...doc });
  return doc;
}

export async function advanceInteriorProject(db: Db, id: string, stage: InteriorStage, actorId: string): Promise<InteriorProject | null> {
  await ensureIndexes(db);
  if (!INTERIOR_STAGES.includes(stage)) throw new Error('Unknown interior stage.');
  const current = await db.collection(INTERIOR_COLLECTION).findOne({ id }) as InteriorProject | null;
  if (!current || current.deletedAt) return null;
  const next: InteriorProject = {
    ...current,
    stage,
    ...stampUpdate({ id: actorId }),
    createdAt: current.createdAt,
    createdBy: current.createdBy,
  };
  const stored = { ...next } as InteriorProject & { _id?: unknown };
  delete stored._id;
  await db.collection(INTERIOR_COLLECTION).updateOne({ id }, { $set: stored });
  return next;
}
