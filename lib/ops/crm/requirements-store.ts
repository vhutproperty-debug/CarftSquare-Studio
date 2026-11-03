import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
// @ts-expect-error JS module without types
import { getDb } from '@/lib/mongodb';
import { stampCreate, stampUpdate } from '@/lib/ops/os/records';

export const REQUIREMENTS_COLLECTION = 'ops_client_requirements';

export type ClientRequirement = {
  id: string;
  clientName: string;
  phone: string;
  bhk: string;
  localities: string[];
  budgetMin: string;
  budgetMax: string;
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
  await db.collection(REQUIREMENTS_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(REQUIREMENTS_COLLECTION).createIndex({ assignedTo: 1, updatedAt: -1 });
  indexesReady = true;
}

export async function getCrmDb(): Promise<Db> {
  return getDb();
}

export async function listRequirements(db: Db): Promise<ClientRequirement[]> {
  await ensureIndexes(db);
  const rows = await db.collection(REQUIREMENTS_COLLECTION).find({}).sort({ updatedAt: -1 }).toArray();
  return (rows as unknown as ClientRequirement[]).filter((row) => !row.deletedAt);
}

export async function createRequirement(
  db: Db,
  input: Partial<Pick<ClientRequirement, 'clientName' | 'phone' | 'bhk' | 'localities' | 'budgetMin' | 'budgetMax' | 'notes' | 'assignedTo'>>,
  actorId: string,
): Promise<ClientRequirement> {
  await ensureIndexes(db);
  const doc: ClientRequirement = {
    id: uuidv4(),
    clientName: input.clientName?.trim() || '',
    phone: input.phone?.trim() || '',
    bhk: input.bhk?.trim() || '',
    localities: (input.localities || []).map((item) => item.trim()).filter(Boolean),
    budgetMin: input.budgetMin?.trim() || '',
    budgetMax: input.budgetMax?.trim() || '',
    notes: input.notes?.trim() || '',
    assignedTo: input.assignedTo?.trim() || actorId,
    ...stampCreate({ id: actorId }),
  };
  if (!doc.bhk && !doc.localities.length && !doc.clientName) {
    throw new Error('Add a configuration, a locality, or a client name.');
  }
  await db.collection(REQUIREMENTS_COLLECTION).insertOne({ ...doc });
  return doc;
}

export async function touchRequirement(db: Db, id: string, actorId: string): Promise<void> {
  await db.collection(REQUIREMENTS_COLLECTION).updateOne({ id }, { $set: stampUpdate({ id: actorId }) });
}
