import { v4 as uuidv4 } from 'uuid';
import type { Db, Filter } from 'mongodb';
// @ts-expect-error JS module without types
import { getDb } from '@/lib/mongodb';
import { computeQualificationPercent } from '@/lib/ops/demand/qualification';
import { createDemandActivity } from '@/lib/ops/demand/activity-store';
import type { DemandQualification, OpsDemandRecord } from '@/lib/ops/demand/types';
import { demandKey } from '@/lib/ops/demand/types';
import type { DemandPriority, DemandStatus } from '@/lib/ops/demand/statuses';
import type { NormalizedOpsLead, OpsLeadSource } from '@/lib/ops/leads/types';
import { normalizeIndianMobile } from '@/lib/phone/indian-mobile';

const COLLECTION = 'ops_demand_records';

let indexesEnsured = false;

export async function ensureDemandIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  await db.collection(COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ source: 1, sourceId: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ normalizedPhone: 1 });
  await db.collection(COLLECTION).createIndex({ normalizedEmail: 1 });
  await db.collection(COLLECTION).createIndex({ status: 1, priority: 1 });
  await db.collection(COLLECTION).createIndex({ assignedTo: 1, status: 1 });
  await db.collection(COLLECTION).createIndex({ nextFollowUpAt: 1 });
  await db.collection(COLLECTION).createIndex({ updatedAt: -1 });
  indexesEnsured = true;
}

function normalizeEmail(email?: string | null): string | undefined {
  const value = email?.trim().toLowerCase();
  return value || undefined;
}

export function defaultDemandRecord(
  lead: NormalizedOpsLead,
  actorId?: string,
): OpsDemandRecord {
  const now = new Date().toISOString();
  const qualification: DemandQualification = {};
  return {
    id: uuidv4(),
    source: lead.source,
    sourceId: lead.sourceId,
    normalizedPhone: normalizeIndianMobile(lead.phone) || undefined,
    normalizedEmail: normalizeEmail(lead.email),
    status: 'NEW',
    priority: 'MEDIUM',
    qualification,
    qualificationPercent: 0,
    createdAt: now,
    updatedAt: now,
    updatedBy: actorId,
  };
}

export async function ensureDemandRecord(
  db: Db,
  lead: NormalizedOpsLead,
  actorId?: string,
): Promise<OpsDemandRecord> {
  await ensureDemandIndexes(db);
  const existing = await db.collection(COLLECTION).findOne(
    { source: lead.source, sourceId: lead.sourceId },
    { projection: { _id: 0 } },
  ) as OpsDemandRecord | null;
  if (existing) return existing;

  const record = defaultDemandRecord(lead, actorId);
  await db.collection(COLLECTION).insertOne(record);
  await createDemandActivity(db, {
    source: lead.source,
    sourceId: lead.sourceId,
    type: 'LEAD_CREATED',
    message: 'Enquiry entered demand operations',
    actorId: actorId || 'system',
  });
  return record;
}

export async function batchGetDemandRecords(
  db: Db,
  keys: Array<{ source: OpsLeadSource; sourceId: string }>,
): Promise<Map<string, OpsDemandRecord>> {
  await ensureDemandIndexes(db);
  if (!keys.length) return new Map();

  const map = new Map<string, OpsDemandRecord>();
  const orFilters = keys.map((k) => ({ source: k.source, sourceId: k.sourceId }));
  const records = await db
    .collection(COLLECTION)
    .find({ $or: orFilters }, { projection: { _id: 0 } })
    .toArray() as OpsDemandRecord[];

  for (const record of records) {
    map.set(demandKey(record.source, record.sourceId), record);
  }
  return map;
}

export async function getDemandRecord(
  db: Db,
  source: OpsLeadSource,
  sourceId: string,
): Promise<OpsDemandRecord | null> {
  await ensureDemandIndexes(db);
  return db.collection(COLLECTION).findOne(
    { source, sourceId },
    { projection: { _id: 0 } },
  ) as Promise<OpsDemandRecord | null>;
}

export async function updateDemandRecord(
  db: Db,
  source: OpsLeadSource,
  sourceId: string,
  patch: Partial<{
    status: DemandStatus;
    priority: DemandPriority;
    assignedTo: string | null;
    assignedToName: string | null;
    internalNotes: string;
    qualification: DemandQualification;
    qualificationPercent: number;
    nextFollowUpAt: string | null;
    followUpCompletedAt: string | null;
    firstContactedAt: string;
    readyForMatchingAt: string;
    lostReason: string;
    updatedBy: string;
  }>,
): Promise<OpsDemandRecord | null> {
  await ensureDemandIndexes(db);
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
    { source, sourceId },
    update,
    { returnDocument: 'after', projection: { _id: 0 } },
  );

  return result as OpsDemandRecord | null;
}

export async function findDuplicatesByContact(
  db: Db,
  phone?: string | null,
  email?: string | null,
  exclude?: { source: OpsLeadSource; sourceId: string },
): Promise<OpsDemandRecord[]> {
  await ensureDemandIndexes(db);
  const filters: Filter<OpsDemandRecord>[] = [];
  const normalizedPhone = normalizeIndianMobile(phone);
  const normalizedEmail = normalizeEmail(email);

  if (normalizedPhone) filters.push({ normalizedPhone });
  if (normalizedEmail) filters.push({ normalizedEmail });
  if (!filters.length) return [];

  const query: Filter<OpsDemandRecord> = { $or: filters };
  if (exclude) {
    query.$nor = [{ source: exclude.source, sourceId: exclude.sourceId }];
  }

  return db.collection(COLLECTION).find(query, { projection: { _id: 0 } }).limit(20).toArray() as Promise<OpsDemandRecord[]>;
}

export async function listAllDemandRecords(db: Db, limit = 5000): Promise<OpsDemandRecord[]> {
  await ensureDemandIndexes(db);
  return db.collection(COLLECTION).find({}, { projection: { _id: 0 } }).limit(limit).toArray() as Promise<OpsDemandRecord[]>;
}

export { getDb as getDatabase };
