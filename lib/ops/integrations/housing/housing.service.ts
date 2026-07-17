import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import type { ConnectorSyncError } from '@/lib/ops/integrations/connector.types';
import {
  HOUSING_RAW_COLLECTION,
  HOUSING_SYNC_LOG_COLLECTION,
  type HousingNormalizedDemand,
  type HousingSyncLogRecord,
  type OpsHousingRawRecord,
} from '@/lib/ops/integrations/housing/housing.types';

let indexesEnsured = false;

export async function ensureHousingIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  await db.collection(HOUSING_RAW_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(HOUSING_RAW_COLLECTION).createIndex({ externalLeadId: 1 }, { unique: true });
  await db.collection(HOUSING_RAW_COLLECTION).createIndex({ syncState: 1, importedAt: -1 });
  await db.collection(HOUSING_RAW_COLLECTION).createIndex({ 'normalized.mobile': 1 });
  await db.collection(HOUSING_RAW_COLLECTION).createIndex({ 'normalized.email': 1 });
  await db.collection(HOUSING_RAW_COLLECTION).createIndex({ updatedAt: -1 });
  await db.collection(HOUSING_SYNC_LOG_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(HOUSING_SYNC_LOG_COLLECTION).createIndex({ startedAt: -1 });
  indexesEnsured = true;
}

export async function getHousingDatabase(): Promise<Db> {
  const db = await getDb();
  await ensureHousingIndexes(db);
  return db;
}

export async function upsertHousingRawRecord(
  db: Db,
  input: {
    id: string;
    externalLeadId: string;
    payload: Record<string, unknown>;
    normalized: HousingNormalizedDemand;
    syncState: OpsHousingRawRecord['syncState'];
    importedAt?: string | null;
    lastError?: string | null;
  },
): Promise<OpsHousingRawRecord> {
  await ensureHousingIndexes(db);
  const now = new Date().toISOString();
  const existing = await db.collection(HOUSING_RAW_COLLECTION).findOne(
    { $or: [{ id: input.id }, { externalLeadId: input.externalLeadId }] },
    { projection: { _id: 0, fetchedAt: 1, id: 1 } },
  ) as { fetchedAt?: string; id?: string } | null;

  const record: OpsHousingRawRecord = {
    id: existing?.id || input.id,
    externalLeadId: input.externalLeadId,
    payload: input.payload,
    normalized: { ...input.normalized, rawReferenceId: existing?.id || input.id },
    syncState: input.syncState,
    fetchedAt: existing?.fetchedAt || now,
    updatedAt: now,
    importedAt: input.importedAt ?? null,
    lastError: input.lastError ?? null,
  };

  await db.collection(HOUSING_RAW_COLLECTION).updateOne(
    { id: record.id },
    { $set: record },
    { upsert: true },
  );

  return record;
}

export async function markHousingRawFailed(
  db: Db,
  externalLeadId: string,
  payload: Record<string, unknown>,
  message: string,
): Promise<void> {
  await ensureHousingIndexes(db);
  const now = new Date().toISOString();
  await db.collection(HOUSING_RAW_COLLECTION).updateOne(
    { externalLeadId },
    {
      $set: {
        externalLeadId,
        payload,
        syncState: 'failed',
        updatedAt: now,
        fetchedAt: now,
        lastError: message,
      },
      $setOnInsert: { id: uuidv4() },
    },
    { upsert: true },
  );
}

export async function createHousingSyncLog(
  db: Db,
  triggeredBy: string,
  kind: HousingSyncLogRecord['kind'] = 'sync',
): Promise<HousingSyncLogRecord> {
  await ensureHousingIndexes(db);
  const log: HousingSyncLogRecord = {
    id: uuidv4(),
    kind,
    startedAt: new Date().toISOString(),
    status: 'running',
    leadsFetched: 0,
    imported: 0,
    updated: 0,
    duplicates: 0,
    failed: 0,
    errors: [],
    triggeredBy,
    authOk: null,
    apiResponseStatus: null,
    lastErrorMessage: null,
    chunksAttempted: null,
    chunksCompleted: null,
    zeroResult: null,
  };
  await db.collection(HOUSING_SYNC_LOG_COLLECTION).insertOne(log);
  return log;
}

export async function completeHousingSyncLog(
  db: Db,
  logId: string,
  patch: Partial<HousingSyncLogRecord> & { errors?: ConnectorSyncError[] },
): Promise<void> {
  await ensureHousingIndexes(db);
  await db.collection(HOUSING_SYNC_LOG_COLLECTION).updateOne(
    { id: logId },
    {
      $set: {
        ...patch,
        completedAt: patch.completedAt || new Date().toISOString(),
        status: patch.status || 'completed',
      },
    },
  );
}

export async function listHousingSyncLogs(db: Db, limit = 20): Promise<HousingSyncLogRecord[]> {
  await ensureHousingIndexes(db);
  const rows = await db.collection(HOUSING_SYNC_LOG_COLLECTION)
    .find({}, { projection: { _id: 0 } })
    .sort({ startedAt: -1 })
    .limit(limit)
    .toArray();
  return rows as unknown as HousingSyncLogRecord[];
}

export async function getLatestHousingSyncLog(db: Db): Promise<HousingSyncLogRecord | null> {
  await ensureHousingIndexes(db);
  const row = await db.collection(HOUSING_SYNC_LOG_COLLECTION)
    .find({}, { projection: { _id: 0 } })
    .sort({ startedAt: -1 })
    .limit(1)
    .next();
  return (row as unknown as HousingSyncLogRecord | null) ?? null;
}

export async function countHousingRawRecords(db: Db): Promise<number> {
  await ensureHousingIndexes(db);
  return db.collection(HOUSING_RAW_COLLECTION).countDocuments({ syncState: 'imported' });
}

export async function countHousingRawToday(db: Db, field: 'importedAt' | 'updatedAt'): Promise<number> {
  await ensureHousingIndexes(db);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return db.collection(HOUSING_RAW_COLLECTION).countDocuments({
    syncState: 'imported',
    [field]: { $gte: start.toISOString() },
  });
}

export async function countHousingFailedRecords(db: Db): Promise<number> {
  await ensureHousingIndexes(db);
  return db.collection(HOUSING_RAW_COLLECTION).countDocuments({ syncState: 'failed' });
}

export async function getLastHousingSyncAt(db: Db): Promise<string | null> {
  const latest = await getLatestHousingSyncLog(db);
  return latest?.completedAt || latest?.startedAt || null;
}

export async function getLastSuccessfulHousingSyncLog(
  db: Db,
): Promise<HousingSyncLogRecord | null> {
  await ensureHousingIndexes(db);
  const row = await db.collection(HOUSING_SYNC_LOG_COLLECTION)
    .find(
      {
        status: 'completed',
        authOk: true,
        $or: [{ kind: 'sync' }, { kind: { $exists: false } }],
      },
      { projection: { _id: 0 } },
    )
    .sort({ completedAt: -1 })
    .limit(1)
    .next();
  return (row as unknown as HousingSyncLogRecord | null) ?? null;
}

export async function getLatestHousingAuthLog(db: Db): Promise<HousingSyncLogRecord | null> {
  await ensureHousingIndexes(db);
  const row = await db.collection(HOUSING_SYNC_LOG_COLLECTION)
    .find(
      { kind: { $in: ['sync', 'test'] } },
      { projection: { _id: 0 } },
    )
    .sort({ startedAt: -1 })
    .limit(1)
    .next();
  return (row as unknown as HousingSyncLogRecord | null) ?? null;
}
