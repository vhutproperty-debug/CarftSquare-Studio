import { v4 as uuidv4 } from 'uuid';
import type { Db, Filter } from 'mongodb';
// @ts-expect-error JS module without types
import { getDb } from '@/lib/mongodb';
import { createMatchActivity } from '@/lib/ops/matching/activity-store';
import type { OpsMatchRecord } from '@/lib/ops/matching/types';
import type { MatchStatus } from '@/lib/ops/matching/statuses';
import { parseDemandKey } from '@/lib/ops/demand/types';

const COLLECTION = 'ops_matches';

let indexesEnsured = false;

export async function ensureMatchIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  await db.collection(COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ demandKey: 1, supplyId: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ status: 1, score: -1 });
  await db.collection(COLLECTION).createIndex({ demandKey: 1, status: 1 });
  await db.collection(COLLECTION).createIndex({ supplyId: 1, status: 1 });
  await db.collection(COLLECTION).createIndex({ broker: 1, status: 1 });
  await db.collection(COLLECTION).createIndex({ score: -1 });
  await db.collection(COLLECTION).createIndex({ createdAt: -1 });
  await db.collection(COLLECTION).createIndex({ updatedAt: -1 });
  indexesEnsured = true;
}

export async function createMatchRecord(
  db: Db,
  payload: {
    demandKey: string;
    supplyId: string;
    score: number;
    reasons: string[];
    actorId: string;
    actorEmail?: string;
    actorName?: string;
  },
): Promise<OpsMatchRecord> {
  await ensureMatchIndexes(db);
  const parsed = parseDemandKey(payload.demandKey);
  if (!parsed) throw new Error('Invalid demand key');

  const now = new Date().toISOString();
  const record: OpsMatchRecord = {
    id: uuidv4(),
    demandKey: payload.demandKey,
    demandSource: parsed.source,
    demandSourceId: parsed.sourceId,
    supplyId: payload.supplyId,
    score: payload.score,
    reasons: payload.reasons,
    status: 'SUGGESTED',
    createdAt: now,
    updatedAt: now,
    updatedBy: payload.actorId,
  };

  await db.collection(COLLECTION).insertOne(record);
  await createMatchActivity(db, {
    matchId: record.id,
    type: 'GENERATED',
    message: `Match generated with score ${payload.score}%`,
    meta: { score: payload.score, reasons: payload.reasons },
    actorId: payload.actorId,
    actorEmail: payload.actorEmail,
    actorName: payload.actorName,
  });

  return record;
}

export async function getMatchRecord(db: Db, id: string): Promise<OpsMatchRecord | null> {
  await ensureMatchIndexes(db);
  return db.collection(COLLECTION).findOne({ id }, { projection: { _id: 0 } }) as Promise<OpsMatchRecord | null>;
}

export async function getMatchByPair(
  db: Db,
  demandKey: string,
  supplyId: string,
): Promise<OpsMatchRecord | null> {
  await ensureMatchIndexes(db);
  return db.collection(COLLECTION).findOne(
    { demandKey, supplyId },
    { projection: { _id: 0 } },
  ) as Promise<OpsMatchRecord | null>;
}

export async function listMatchRecords(
  db: Db,
  filter: Filter<OpsMatchRecord> = {},
  limit = 5000,
): Promise<OpsMatchRecord[]> {
  await ensureMatchIndexes(db);
  return db.collection(COLLECTION).find(filter, { projection: { _id: 0 } }).limit(limit).toArray() as Promise<OpsMatchRecord[]>;
}

export async function updateMatchRecord(
  db: Db,
  id: string,
  patch: Partial<{
    score: number;
    reasons: string[];
    status: MatchStatus;
    broker: string | null;
    brokerName: string | null;
    notes: string;
    siteVisitAt: string | null;
    updatedBy: string;
  }>,
): Promise<OpsMatchRecord | null> {
  await ensureMatchIndexes(db);
  const updatedAt = new Date().toISOString();
  const setDoc: Record<string, unknown> = { updatedAt };
  const unsetDoc: Record<string, string> = {};

  for (const [key, value] of Object.entries(patch)) {
    if (value === null) unsetDoc[key] = '';
    else if (value !== undefined) setDoc[key] = value;
  }

  const update: Record<string, unknown> = { $set: setDoc };
  if (Object.keys(unsetDoc).length) update.$unset = unsetDoc;

  const result = await db.collection(COLLECTION).findOneAndUpdate(
    { id },
    update,
    { returnDocument: 'after', projection: { _id: 0 } },
  );

  return result as OpsMatchRecord | null;
}

export { getDb as getDatabase };
