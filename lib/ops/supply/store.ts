import { v4 as uuidv4 } from 'uuid';
import type { Db, Filter } from 'mongodb';
// @ts-expect-error JS module without types
import { getDb } from '@/lib/mongodb';
import { createSupplyActivity } from '@/lib/ops/supply/activity-store';
import type { OpsSupplyRecord } from '@/lib/ops/supply/types';
import type { SupplyPriority, SupplySource, SupplyStatus } from '@/lib/ops/supply/statuses';
import { normalizeIndianMobile } from '@/lib/phone/indian-mobile';

const COLLECTION = 'ops_supply_records';

let indexesEnsured = false;

export async function ensureSupplyIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  await db.collection(COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ status: 1, priority: 1 });
  await db.collection(COLLECTION).createIndex({ project: 1 });
  await db.collection(COLLECTION).createIndex({ building: 1 });
  await db.collection(COLLECTION).createIndex({ normalizedOwnerMobile: 1 });
  await db.collection(COLLECTION).createIndex({ agreementExpiry: 1 });
  await db.collection(COLLECTION).createIndex({ availableFrom: 1 });
  await db.collection(COLLECTION).createIndex({ assignedBroker: 1, status: 1 });
  await db.collection(COLLECTION).createIndex({ readyForMatching: 1 });
  await db.collection(COLLECTION).createIndex({ updatedAt: -1 });
  await db.collection(COLLECTION).createIndex({ listingType: 1 });
  await db.collection(COLLECTION).createIndex({ prospectId: 1 }, { sparse: true });
  indexesEnsured = true;
}

function normalizeEmail(email?: string | null): string | undefined {
  const value = email?.trim().toLowerCase();
  return value || undefined;
}

export function defaultSupplyRecord(
  payload: Partial<OpsSupplyRecord> & { source: SupplySource },
  actorId?: string,
): OpsSupplyRecord {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    propertyType: payload.propertyType,
    listingType: payload.listingType,
    project: payload.project,
    building: payload.building,
    wing: payload.wing,
    flatNumber: payload.flatNumber,
    configuration: payload.configuration,
    carpetArea: payload.carpetArea,
    floor: payload.floor,
    facing: payload.facing,
    parking: payload.parking,
    ownerName: payload.ownerName,
    ownerMobile: payload.ownerMobile,
    ownerEmail: payload.ownerEmail,
    normalizedOwnerMobile: normalizeIndianMobile(payload.ownerMobile) || undefined,
    normalizedOwnerEmail: normalizeEmail(payload.ownerEmail),
    source: payload.source,
    exclusive: payload.exclusive ?? false,
    availableFrom: payload.availableFrom,
    expectedRent: payload.expectedRent,
    expectedDeposit: payload.expectedDeposit,
    expectedSalePrice: payload.expectedSalePrice,
    brokeragePercent: payload.brokeragePercent,
    furnishedStatus: payload.furnishedStatus,
    keysAvailable: payload.keysAvailable,
    tenantOccupied: payload.tenantOccupied,
    agreementExpiry: payload.agreementExpiry,
    possessionStatus: payload.possessionStatus,
    lastContactAt: payload.lastContactAt,
    assignedBroker: payload.assignedBroker,
    assignedBrokerName: payload.assignedBrokerName,
    priority: payload.priority || 'MEDIUM',
    status: payload.status || 'NEW',
    availabilityStatus: payload.availabilityStatus,
    readyForMatching: payload.readyForMatching ?? false,
    internalNotes: payload.internalNotes,
    prospectId: payload.prospectId,
    createdAt: now,
    updatedAt: now,
    updatedBy: actorId,
  };
}

export async function createSupplyRecord(
  db: Db,
  payload: Partial<OpsSupplyRecord> & { source: SupplySource },
  actorId: string,
  actorEmail?: string,
  actorName?: string,
): Promise<OpsSupplyRecord> {
  await ensureSupplyIndexes(db);
  const record = defaultSupplyRecord(payload, actorId);
  await db.collection(COLLECTION).insertOne(record);
  await createSupplyActivity(db, {
    supplyId: record.id,
    type: 'CREATED',
    message: 'Supply record created',
    actorId,
    actorEmail,
    actorName,
  });
  return record;
}

export async function getSupplyRecord(db: Db, id: string): Promise<OpsSupplyRecord | null> {
  await ensureSupplyIndexes(db);
  return db.collection(COLLECTION).findOne({ id }, { projection: { _id: 0 } }) as Promise<OpsSupplyRecord | null>;
}

export async function listSupplyRecords(
  db: Db,
  filter: Filter<OpsSupplyRecord> = {},
  limit = 5000,
): Promise<OpsSupplyRecord[]> {
  await ensureSupplyIndexes(db);
  return db.collection(COLLECTION).find(filter, { projection: { _id: 0 } }).limit(limit).toArray() as Promise<OpsSupplyRecord[]>;
}

export async function updateSupplyRecord(
  db: Db,
  id: string,
  patch: Partial<{
    propertyType: string;
    listingType: 'rent' | 'sale';
    project: string;
    building: string;
    wing: string;
    flatNumber: string;
    configuration: string;
    carpetArea: string;
    floor: string;
    facing: string;
    parking: string;
    ownerName: string;
    ownerMobile: string;
    ownerEmail: string;
    normalizedOwnerMobile: string;
    normalizedOwnerEmail: string;
    source: SupplySource;
    exclusive: boolean;
    availableFrom: string | null;
    expectedRent: string;
    expectedDeposit: string;
    expectedSalePrice: string;
    brokeragePercent: string;
    furnishedStatus: string;
    keysAvailable: boolean;
    tenantOccupied: boolean;
    agreementExpiry: string | null;
    possessionStatus: string;
    lastContactAt: string | null;
    assignedBroker: string | null;
    assignedBrokerName: string | null;
    priority: SupplyPriority;
    status: SupplyStatus;
    availabilityStatus: string;
    readyForMatching: boolean;
    readyForMatchingAt: string;
    internalNotes: string;
    nextFollowUpAt: string | null;
    followUpCompletedAt: string;
    updatedBy: string;
  }>,
): Promise<OpsSupplyRecord | null> {
  await ensureSupplyIndexes(db);
  const updatedAt = new Date().toISOString();
  const setDoc: Record<string, unknown> = { updatedAt };
  const unsetDoc: Record<string, string> = {};

  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      unsetDoc[key] = '';
    } else if (value !== undefined) {
      setDoc[key] = value;
    }
  }

  const update: Record<string, unknown> = { $set: setDoc };
  if (Object.keys(unsetDoc).length) update.$unset = unsetDoc;

  const result = await db.collection(COLLECTION).findOneAndUpdate(
    { id },
    update,
    { returnDocument: 'after', projection: { _id: 0 } },
  );

  return result as OpsSupplyRecord | null;
}

export { getDb as getDatabase };
