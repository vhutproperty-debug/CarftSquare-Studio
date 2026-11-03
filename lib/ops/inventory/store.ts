import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
// @ts-expect-error JS module without types
import { getDb } from '@/lib/mongodb';
import { stampCreate, stampUpdate, softDeletePatch } from '@/lib/ops/os/records';
import { attachCandidateUnits, canonicalKey } from '@/lib/ops/inventory/identity';

export const DEVELOPERS_COLLECTION = 'ops_developers';
export const TOWERS_COLLECTION = 'ops_towers';
export const APARTMENTS_COLLECTION = 'ops_canonical_apartments';
export const RENTALS_COLLECTION = 'ops_rental_listings';

type Stamped = {
  id: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  assignedTo?: string;
};

export type InventoryDeveloper = Stamped & {
  name: string;
  locality: string;
  rera: string;
};

export type InventoryTower = Stamped & {
  developerId: string;
  projectName: string;
  name: string;
};

export type CanonicalApartment = Stamped & {
  developerId: string;
  towerId: string;
  projectName: string;
  towerName: string;
  flat: string;
  canonicalKey: string;
  candidateUnitIds: string[];
};

export type RentalListing = Stamped & {
  apartmentId: string;
  rent: string;
  deposit: string;
  status: 'available' | 'on_hold' | 'leased';
};

let indexesReady = false;

async function ensureIndexes(db: Db): Promise<void> {
  if (indexesReady) return;
  await db.collection(DEVELOPERS_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(TOWERS_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(APARTMENTS_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(APARTMENTS_COLLECTION).createIndex({ canonicalKey: 1 }, { unique: true });
  await db.collection(RENTALS_COLLECTION).createIndex({ id: 1 }, { unique: true });
  indexesReady = true;
}

function alive<T extends { deletedAt?: string | null }>(rows: T[]): T[] {
  return rows.filter((row) => !row.deletedAt);
}

async function listAll<T>(db: Db, name: string): Promise<T[]> {
  await ensureIndexes(db);
  const rows = await db.collection(name).find({}).toArray();
  return alive(rows as unknown as T[]);
}

export async function getInventoryDb(): Promise<Db> {
  return getDb();
}

export async function listDevelopers(db: Db) { return listAll<InventoryDeveloper>(db, DEVELOPERS_COLLECTION); }
export async function listTowers(db: Db) { return listAll<InventoryTower>(db, TOWERS_COLLECTION); }
export async function listApartments(db: Db) { return listAll<CanonicalApartment>(db, APARTMENTS_COLLECTION); }
export async function listRentals(db: Db) { return listAll<RentalListing>(db, RENTALS_COLLECTION); }

export async function createDeveloper(db: Db, input: { name: string; locality?: string; rera?: string; assignedTo?: string }, actorId: string): Promise<InventoryDeveloper> {
  await ensureIndexes(db);
  const doc: InventoryDeveloper = {
    id: uuidv4(),
    name: input.name.trim(),
    locality: input.locality?.trim() || '',
    rera: input.rera?.trim() || '',
    assignedTo: input.assignedTo || '',
    ...stampCreate({ id: actorId }),
  };
  if (!doc.name) throw new Error('Developer name is required.');
  await db.collection(DEVELOPERS_COLLECTION).insertOne({ ...doc });
  return doc;
}

export async function createTower(db: Db, input: { developerId: string; projectName: string; name: string; assignedTo?: string }, actorId: string): Promise<InventoryTower> {
  await ensureIndexes(db);
  const doc: InventoryTower = {
    id: uuidv4(),
    developerId: input.developerId.trim(),
    projectName: input.projectName.trim(),
    name: input.name.trim(),
    assignedTo: input.assignedTo || '',
    ...stampCreate({ id: actorId }),
  };
  if (!doc.developerId || !doc.projectName || !doc.name) throw new Error('Developer, project, and tower name are required.');
  await db.collection(TOWERS_COLLECTION).insertOne({ ...doc });
  return doc;
}

export async function saveApartment(
  db: Db,
  input: { developerId: string; towerId: string; projectName: string; towerName: string; flat: string; candidateUnitIds?: string[]; assignedTo?: string },
  actorId: string,
): Promise<{ apartment: CanonicalApartment; created: boolean }> {
  await ensureIndexes(db);
  const key = canonicalKey(input.projectName, input.towerName, input.flat);
  if (!key || !input.flat.trim()) throw new Error('Project, tower, and flat are required.');
  const existing = await db.collection(APARTMENTS_COLLECTION).findOne({ canonicalKey: key }) as CanonicalApartment | null;
  const candidates = attachCandidateUnits(existing?.candidateUnitIds || [], input.candidateUnitIds || []);
  if (existing) {
    const next: CanonicalApartment = {
      ...existing,
      candidateUnitIds: candidates,
      deletedAt: null,
      ...stampUpdate({ id: actorId }),
      createdAt: existing.createdAt,
      createdBy: existing.createdBy,
    };
    const stored = { ...next } as CanonicalApartment & { _id?: unknown };
    delete stored._id;
    await db.collection(APARTMENTS_COLLECTION).updateOne({ id: existing.id }, { $set: stored });
    return { apartment: next, created: false };
  }
  const doc: CanonicalApartment = {
    id: uuidv4(),
    developerId: input.developerId.trim(),
    towerId: input.towerId.trim(),
    projectName: input.projectName.trim(),
    towerName: input.towerName.trim(),
    flat: input.flat.trim(),
    canonicalKey: key,
    candidateUnitIds: candidates,
    assignedTo: input.assignedTo || '',
    ...stampCreate({ id: actorId }),
  };
  await db.collection(APARTMENTS_COLLECTION).insertOne({ ...doc });
  return { apartment: doc, created: true };
}

export async function createRental(
  db: Db,
  input: { apartmentId: string; rent?: string; deposit?: string; status?: RentalListing['status']; assignedTo?: string },
  actorId: string,
): Promise<RentalListing> {
  await ensureIndexes(db);
  const apartment = await db.collection(APARTMENTS_COLLECTION).findOne({ id: input.apartmentId }) as CanonicalApartment | null;
  if (!apartment || apartment.deletedAt) throw new Error('Canonical apartment not found.');
  const doc: RentalListing = {
    id: uuidv4(),
    apartmentId: input.apartmentId,
    rent: input.rent?.trim() || '',
    deposit: input.deposit?.trim() || '',
    status: input.status || 'available',
    assignedTo: input.assignedTo || apartment.assignedTo || '',
    ...stampCreate({ id: actorId }),
  };
  await db.collection(RENTALS_COLLECTION).insertOne({ ...doc });
  return doc;
}

export async function softDeleteInventory(db: Db, collection: string, id: string, actorId: string): Promise<boolean> {
  const existing = await db.collection(collection).findOne({ id });
  if (!existing) return false;
  await db.collection(collection).updateOne({ id }, { $set: softDeletePatch({ id: actorId }) });
  return true;
}
