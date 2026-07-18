import { v4 as uuidv4 } from 'uuid';
import type { Db, Filter } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { BROKER_IMPORT_CONFIG } from '@/lib/ops/brokers/config';
import { computeFreshnessStatus } from '@/lib/ops/brokers/freshness';
import { diffInventoryChanges, ensureHistoryIndexes, insertHistoryEvents } from '@/lib/ops/brokers/history';
import { ensureBrokerDirectoryIndexes } from '@/lib/ops/brokers/directory';
import { ensureProjectAliasIndexes } from '@/lib/ops/brokers/normalize/project-aliases';
import { ensureReviewIndexes } from '@/lib/ops/brokers/review';
import type {
  BrokerConfidenceBreakdown,
  OpsBrokerImportBatch,
  OpsBrokerInventory,
  OpsBrokerRawMessage,
} from '@/lib/ops/brokers/types';
import type {
  BrokerFreshnessStatus,
  BrokerImportStatus,
  BrokerInventoryStatus,
  BrokerSourceType,
} from '@/lib/ops/brokers/statuses';

export const BROKER_BATCHES_COLLECTION = 'ops_broker_import_batches';
export const BROKER_RAW_MESSAGES_COLLECTION = 'ops_broker_raw_messages';
export const BROKER_INVENTORY_COLLECTION = 'ops_broker_inventory';

let indexesEnsured = false;

export async function getDatabase(): Promise<Db> {
  return getDb() as Promise<Db>;
}

export async function ensureBrokerIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;

  await db.collection(BROKER_BATCHES_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(BROKER_BATCHES_COLLECTION).createIndex({ fileHash: 1 }, { unique: true });
  await db.collection(BROKER_BATCHES_COLLECTION).createIndex({ uploadedAt: -1 });
  await db.collection(BROKER_BATCHES_COLLECTION).createIndex({ groupName: 1, uploadedAt: -1 });
  await db.collection(BROKER_BATCHES_COLLECTION).createIndex({ importStatus: 1, uploadedAt: -1 });

  await db.collection(BROKER_RAW_MESSAGES_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(BROKER_RAW_MESSAGES_COLLECTION).createIndex({ batchId: 1, sequence: 1 });
  await db.collection(BROKER_RAW_MESSAGES_COLLECTION).createIndex(
    { batchId: 1, messageHash: 1 },
    { unique: true },
  );
  await db.collection(BROKER_RAW_MESSAGES_COLLECTION).createIndex({ messageHash: 1 });
  await db.collection(BROKER_RAW_MESSAGES_COLLECTION).createIndex({ listingCandidate: 1, batchId: 1 });
  await db.collection(BROKER_RAW_MESSAGES_COLLECTION).createIndex({
    batchId: 1,
    listingCandidate: 1,
    parseStatus: 1,
    sequence: 1,
  });
  await db.collection(BROKER_RAW_MESSAGES_COLLECTION).createIndex({ groupName: 1, messageTimestamp: -1 });
  await db.collection(BROKER_RAW_MESSAGES_COLLECTION).createIndex({ parseStatus: 1, batchId: 1 });

  await db.collection(BROKER_INVENTORY_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(BROKER_INVENTORY_COLLECTION).createIndex({ dedupeKey: 1 }, { unique: true });
  await db.collection(BROKER_INVENTORY_COLLECTION).createIndex({ freshnessStatus: 1, lastSeenAt: -1 });
  await db.collection(BROKER_INVENTORY_COLLECTION).createIndex({ projectNormalized: 1 });
  await db.collection(BROKER_INVENTORY_COLLECTION).createIndex({ projectName: 1 });
  await db.collection(BROKER_INVENTORY_COLLECTION).createIndex({ transactionType: 1 });
  await db.collection(BROKER_INVENTORY_COLLECTION).createIndex({ brokerName: 1 });
  await db.collection(BROKER_INVENTORY_COLLECTION).createIndex({ brokerPhone: 1 });
  await db.collection(BROKER_INVENTORY_COLLECTION).createIndex({ brokerId: 1 });
  await db.collection(BROKER_INVENTORY_COLLECTION).createIndex({ groupName: 1 });
  await db.collection(BROKER_INVENTORY_COLLECTION).createIndex({ bhk: 1 });
  await db.collection(BROKER_INVENTORY_COLLECTION).createIndex({ furnishing: 1 });
  await db.collection(BROKER_INVENTORY_COLLECTION).createIndex({ status: 1, lastSeenAt: -1 });
  await db.collection(BROKER_INVENTORY_COLLECTION).createIndex({ lastImportBatchId: 1 });
  await db.collection(BROKER_INVENTORY_COLLECTION).createIndex({ overallConfidence: -1 });
  await db.collection(BROKER_INVENTORY_COLLECTION).createIndex({ sourceType: 1 });
  await db.collection(BROKER_INVENTORY_COLLECTION).createIndex({ projectMapped: 1 });

  await Promise.all([
    ensureHistoryIndexes(db),
    ensureReviewIndexes(db),
    ensureBrokerDirectoryIndexes(db),
    ensureProjectAliasIndexes(db),
  ]);

  indexesEnsured = true;
}

export async function findBatchByFileHash(
  db: Db,
  fileHash: string,
): Promise<OpsBrokerImportBatch | null> {
  await ensureBrokerIndexes(db);
  return db.collection<OpsBrokerImportBatch>(BROKER_BATCHES_COLLECTION).findOne({ fileHash });
}

export async function createImportBatch(
  db: Db,
  payload: {
    groupName: string;
    fileName: string;
    fileHash: string;
    uploadedBy: string;
    uploadedByEmail?: string;
  },
): Promise<OpsBrokerImportBatch> {
  await ensureBrokerIndexes(db);
  const now = new Date().toISOString();
  const batch: OpsBrokerImportBatch = {
    id: uuidv4(),
    groupName: payload.groupName.trim(),
    fileName: payload.fileName,
    fileHash: payload.fileHash,
    uploadedBy: payload.uploadedBy,
    uploadedByEmail: payload.uploadedByEmail,
    uploadedAt: now,
    importStatus: 'PENDING',
    stage: 'PENDING',
    totalMessages: 0,
    candidateListings: 0,
    createdListings: 0,
    updatedListings: 0,
    duplicateListings: 0,
    failedMessages: 0,
    skippedMessages: 0,
    malformedMessages: 0,
    reviewQueued: 0,
    unknownProjects: 0,
    listingsExtracted: 0,
    processingErrors: [],
    resumeToken: 0,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await db.collection(BROKER_BATCHES_COLLECTION).insertOne(batch);
    return batch;
  } catch (err) {
    const code = typeof err === 'object' && err && 'code' in err ? (err as { code?: number }).code : undefined;
    if (code === 11000) {
      const existing = await findBatchByFileHash(db, payload.fileHash);
      if (existing) return existing;
    }
    throw err;
  }
}

export async function updateImportBatch(
  db: Db,
  id: string,
  patch: Partial<OpsBrokerImportBatch>,
): Promise<OpsBrokerImportBatch | null> {
  await ensureBrokerIndexes(db);
  const updatedAt = new Date().toISOString();
  await db.collection(BROKER_BATCHES_COLLECTION).updateOne(
    { id },
    { $set: { ...patch, updatedAt } },
  );
  return db.collection<OpsBrokerImportBatch>(BROKER_BATCHES_COLLECTION).findOne({ id });
}

/**
 * Atomically claim a batch for processing to prevent concurrent double-imports.
 * Returns null if another worker holds a fresh PROCESSING lease.
 */
export async function claimImportBatch(
  db: Db,
  batchId: string,
  leaseMs: number,
): Promise<OpsBrokerImportBatch | null> {
  await ensureBrokerIndexes(db);
  const now = new Date();
  const leaseCutoff = new Date(now.getTime() - leaseMs).toISOString();
  const startedAt = now.toISOString();

  const result = await db.collection<OpsBrokerImportBatch>(BROKER_BATCHES_COLLECTION).findOneAndUpdate(
    {
      id: batchId,
      $or: [
        { importStatus: { $in: ['PENDING', 'FAILED', 'PARTIAL', 'COMPLETED_WITH_ERRORS'] } },
        { importStatus: 'PROCESSING', updatedAt: { $lte: leaseCutoff } },
        { importStatus: 'PROCESSING', startedAt: { $lte: leaseCutoff } },
      ],
    },
    {
      $set: {
        importStatus: 'PROCESSING',
        startedAt,
        updatedAt: startedAt,
        failureReason: undefined,
      },
    },
    { returnDocument: 'after' },
  );

  // Driver versions may return the doc directly or { value }
  const doc = (result && typeof result === 'object' && 'value' in result
    ? (result as { value: OpsBrokerImportBatch | null }).value
    : result) as OpsBrokerImportBatch | null;
  return doc || null;
}

export async function getImportBatch(db: Db, id: string): Promise<OpsBrokerImportBatch | null> {
  await ensureBrokerIndexes(db);
  return db.collection<OpsBrokerImportBatch>(BROKER_BATCHES_COLLECTION).findOne({ id });
}

export async function listImportBatches(
  db: Db,
  page: number,
  pageSize: number,
): Promise<{ items: OpsBrokerImportBatch[]; total: number }> {
  await ensureBrokerIndexes(db);
  const col = db.collection<OpsBrokerImportBatch>(BROKER_BATCHES_COLLECTION);
  const total = await col.countDocuments({});
  const items = await col
    .find({})
    .sort({ uploadedAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .toArray();
  return { items, total };
}

export async function findRawMessageByHash(
  db: Db,
  messageHash: string,
): Promise<OpsBrokerRawMessage | null> {
  await ensureBrokerIndexes(db);
  return db.collection<OpsBrokerRawMessage>(BROKER_RAW_MESSAGES_COLLECTION).findOne({ messageHash });
}

function isDuplicateKeyError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as {
    code?: number;
    writeErrors?: Array<{ code?: number }>;
    result?: { writeErrors?: Array<{ code?: number }> };
  };
  if (e.code === 11000) return true;
  const writeErrors = e.writeErrors || e.result?.writeErrors;
  if (Array.isArray(writeErrors) && writeErrors.length > 0) {
    return writeErrors.every((w) => w.code === 11000);
  }
  return false;
}

export async function insertRawMessages(
  db: Db,
  messages: OpsBrokerRawMessage[],
): Promise<void> {
  if (!messages.length) return;
  await ensureBrokerIndexes(db);
  try {
    await db.collection(BROKER_RAW_MESSAGES_COLLECTION).insertMany(messages, { ordered: false });
  } catch (err) {
    // Idempotent resume: ignore pure duplicate-key bulk failures
    if (!isDuplicateKeyError(err)) throw err;
  }
}

export async function getRawMessagesByIds(
  db: Db,
  ids: string[],
): Promise<OpsBrokerRawMessage[]> {
  if (!ids.length) return [];
  await ensureBrokerIndexes(db);
  return db
    .collection<OpsBrokerRawMessage>(BROKER_RAW_MESSAGES_COLLECTION)
    .find({ id: { $in: ids } })
    .toArray();
}

export async function getRawMessagesForBatch(
  db: Db,
  batchId: string,
  limit = 200,
): Promise<OpsBrokerRawMessage[]> {
  await ensureBrokerIndexes(db);
  return db
    .collection<OpsBrokerRawMessage>(BROKER_RAW_MESSAGES_COLLECTION)
    .find({ batchId })
    .sort({ messageTimestamp: 1 })
    .limit(limit)
    .toArray();
}

export async function findInventoryByDedupeKey(
  db: Db,
  dedupeKey: string,
): Promise<OpsBrokerInventory | null> {
  await ensureBrokerIndexes(db);
  return db.collection<OpsBrokerInventory>(BROKER_INVENTORY_COLLECTION).findOne({ dedupeKey });
}

export async function createInventoryRecord(
  db: Db,
  record: OpsBrokerInventory,
): Promise<OpsBrokerInventory> {
  await ensureBrokerIndexes(db);
  await db.collection(BROKER_INVENTORY_COLLECTION).insertOne(record);
  return record;
}

export async function refreshInventoryRecord(
  db: Db,
  existing: OpsBrokerInventory,
  patch: Partial<OpsBrokerInventory> & {
    sourceMessageId: string;
    lastImportBatchId: string;
    lastSeenAt: string;
    lastMessageAt?: string;
  },
): Promise<OpsBrokerInventory> {
  await ensureBrokerIndexes(db);
  const now = new Date().toISOString();
  let sourceMessageIds = existing.sourceMessageIds.includes(patch.sourceMessageId)
    ? existing.sourceMessageIds
    : [...existing.sourceMessageIds, patch.sourceMessageId];
  if (sourceMessageIds.length > BROKER_IMPORT_CONFIG.maxSourceMessageIds) {
    sourceMessageIds = sourceMessageIds.slice(-BROKER_IMPORT_CONFIG.maxSourceMessageIds);
  }

  const lastSeenAt = patch.lastSeenAt;
  const freshnessStatus = computeFreshnessStatus(lastSeenAt);

  const next: Partial<OpsBrokerInventory> = {
    lastSeenAt,
    lastMessageAt: patch.lastMessageAt || lastSeenAt,
    lastImportBatchId: patch.lastImportBatchId,
    sourceMessageIds,
    occurrenceCount: existing.occurrenceCount + 1,
    freshnessStatus,
    updatedAt: now,
    status: existing.status === 'ARCHIVED' ? 'ACTIVE' : existing.status,
  };

  const mutableKeys: Array<keyof OpsBrokerInventory> = [
    'projectName',
    'projectNormalized',
    'projectMapped',
    'tower',
    'wing',
    'unitNumber',
    'configuration',
    'bhk',
    'transactionType',
    'propertyType',
    'carpetArea',
    'builtUpArea',
    'rent',
    'salePrice',
    'deposit',
    'maintenance',
    'furnishing',
    'parking',
    'availability',
    'availableFrom',
    'floor',
    'notes',
    'brokerId',
    'brokerName',
    'brokerPhone',
    'extractedText',
    'overallConfidence',
    'parserConfidence',
    'projectConfidence',
    'configurationConfidence',
    'priceConfidence',
    'phoneConfidence',
  ];

  for (const key of mutableKeys) {
    const value = patch[key];
    if (value !== undefined && value !== null && value !== '') {
      (next as Record<string, unknown>)[key] = value;
    }
  }

  const history = diffInventoryChanges(existing, next, {
    sourceMessageId: patch.sourceMessageId,
    importBatchId: patch.lastImportBatchId,
    changedAt: now,
  });
  if (history.length) {
    await insertHistoryEvents(db, history);
  }

  await db.collection(BROKER_INVENTORY_COLLECTION).updateOne({ id: existing.id }, { $set: next });
  return { ...existing, ...next } as OpsBrokerInventory;
}

export function buildInventoryRecord(input: {
  extracted: Partial<OpsBrokerInventory>;
  dedupeKey: string;
  batchId: string;
  messageId: string;
  groupName: string;
  brokerId?: string;
  brokerName?: string;
  brokerPhone?: string;
  originalSenderName?: string;
  originalSenderPhone?: string;
  seenAt: string;
  confidence?: BrokerConfidenceBreakdown;
  sourceType?: BrokerSourceType;
}): OpsBrokerInventory {
  const now = new Date().toISOString();
  const seenAt = input.seenAt || now;
  return {
    id: uuidv4(),
    brokerId: input.brokerId,
    brokerName: input.brokerName,
    brokerPhone: input.brokerPhone,
    originalSenderName: input.originalSenderName || input.brokerName,
    originalSenderPhone: input.originalSenderPhone || input.brokerPhone,
    groupName: input.groupName,
    projectName: input.extracted.projectName,
    projectNormalized: input.extracted.projectNormalized,
    projectMapped: input.extracted.projectMapped,
    tower: input.extracted.tower,
    wing: input.extracted.wing,
    unitNumber: input.extracted.unitNumber,
    configuration: input.extracted.configuration,
    bhk: input.extracted.bhk,
    transactionType: input.extracted.transactionType || 'UNKNOWN',
    propertyType: input.extracted.propertyType,
    carpetArea: input.extracted.carpetArea,
    builtUpArea: input.extracted.builtUpArea,
    rent: input.extracted.rent,
    salePrice: input.extracted.salePrice,
    deposit: input.extracted.deposit,
    maintenance: input.extracted.maintenance,
    furnishing: input.extracted.furnishing || 'UNKNOWN',
    parking: input.extracted.parking,
    availability: input.extracted.availability,
    availableFrom: input.extracted.availableFrom,
    floor: input.extracted.floor,
    notes: input.extracted.notes,
    extractedText: input.extracted.extractedText,
    firstSeenAt: seenAt,
    lastSeenAt: seenAt,
    lastMessageAt: seenAt,
    lastImportBatchId: input.batchId,
    sourceMessageIds: [input.messageId],
    occurrenceCount: 1,
    freshnessStatus: computeFreshnessStatus(seenAt),
    status: 'ACTIVE',
    dedupeKey: input.dedupeKey,
    sourceType: input.sourceType || 'BROKER_GROUP',
    overallConfidence: input.confidence?.overallConfidence,
    parserConfidence: input.confidence?.parserConfidence,
    projectConfidence: input.confidence?.projectConfidence,
    configurationConfidence: input.confidence?.configurationConfidence,
    priceConfidence: input.confidence?.priceConfidence,
    phoneConfidence: input.confidence?.phoneConfidence,
    createdAt: now,
    updatedAt: now,
  };
}

export async function listCandidateMessagesForBatch(
  db: Db,
  batchId: string,
  fromSequence = 0,
  limit = BROKER_IMPORT_CONFIG.candidatePageSize,
): Promise<OpsBrokerRawMessage[]> {
  await ensureBrokerIndexes(db);
  return db
    .collection<OpsBrokerRawMessage>(BROKER_RAW_MESSAGES_COLLECTION)
    .find({
      batchId,
      listingCandidate: true,
      parseStatus: 'PARSED',
      sequence: { $gte: fromSequence },
    })
    .sort({ sequence: 1 })
    .limit(limit)
    .toArray();
}

export async function countRawByStatus(
  db: Db,
  batchId: string,
): Promise<{ malformed: number; skipped: number; system: number }> {
  await ensureBrokerIndexes(db);
  const col = db.collection(BROKER_RAW_MESSAGES_COLLECTION);
  const [malformed, skipped, system] = await Promise.all([
    col.countDocuments({ batchId, parseStatus: 'MALFORMED' }),
    col.countDocuments({ batchId, parseStatus: 'SKIPPED' }),
    col.countDocuments({ batchId, parseStatus: 'SYSTEM' }),
  ]);
  return { malformed, skipped, system };
}

export async function getInventoryById(
  db: Db,
  id: string,
): Promise<OpsBrokerInventory | null> {
  await ensureBrokerIndexes(db);
  return db.collection<OpsBrokerInventory>(BROKER_INVENTORY_COLLECTION).findOne({ id });
}

export async function listInventory(
  db: Db,
  filter: Filter<OpsBrokerInventory>,
  options: {
    page: number;
    pageSize: number;
    sort: string;
    sortDir: 'asc' | 'desc';
  },
): Promise<{ items: OpsBrokerInventory[]; total: number }> {
  await ensureBrokerIndexes(db);
  const col = db.collection<OpsBrokerInventory>(BROKER_INVENTORY_COLLECTION);
  const total = await col.countDocuments(filter);
  const sortField = options.sort || 'lastSeenAt';
  const dir = options.sortDir === 'asc' ? 1 : -1;
  const items = await col
    .find(filter)
    .sort({ [sortField]: dir })
    .skip((options.page - 1) * options.pageSize)
    .limit(options.pageSize)
    .toArray();
  return { items, total };
}

export async function recalculateAllFreshness(db: Db): Promise<{ updated: number }> {
  await ensureBrokerIndexes(db);
  const col = db.collection<OpsBrokerInventory>(BROKER_INVENTORY_COLLECTION);
  const now = new Date();
  const updatedAt = now.toISOString();
  let updated = 0;
  const cursor = col.find(
    { status: { $ne: 'ARCHIVED' } },
    { projection: { id: 1, lastSeenAt: 1, freshnessStatus: 1 } },
  );

  let ops: Array<{
    updateOne: {
      filter: { id: string };
      update: { $set: { freshnessStatus: BrokerFreshnessStatus; updatedAt: string } };
    };
  }> = [];

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    if (!doc) break;
    const next = computeFreshnessStatus(doc.lastSeenAt, now);
    if (next === doc.freshnessStatus) continue;
    ops.push({
      updateOne: {
        filter: { id: doc.id },
        update: { $set: { freshnessStatus: next, updatedAt } },
      },
    });
    if (ops.length >= 250) {
      const result = await col.bulkWrite(ops, { ordered: false });
      updated += result.modifiedCount;
      ops = [];
    }
  }
  if (ops.length) {
    const result = await col.bulkWrite(ops, { ordered: false });
    updated += result.modifiedCount;
  }

  return { updated };
}

export async function getWorkspaceAggregates(db: Db): Promise<{
  totalActive: number;
  fresh: number;
  aging: number;
  stale: number;
  rental: number;
  sale: number;
  uniqueProjects: number;
  uniqueBrokers: number;
  lastImportAt: string | null;
  projects: string[];
  brokers: string[];
  groups: string[];
}> {
  await ensureBrokerIndexes(db);
  const inv = db.collection(BROKER_INVENTORY_COLLECTION);
  const activeFilter = { status: 'ACTIVE' as BrokerInventoryStatus };

  const topField = async (field: string) =>
    inv
      .aggregate<{ _id: string }>([
        { $match: { ...activeFilter, [field]: { $exists: true, $nin: [null, ''] } } },
        { $group: { _id: `$${field}`, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 100 },
      ])
      .toArray()
      .then((rows) => rows.map((r) => r._id).filter(Boolean).sort());

  const [
    totalActive,
    fresh,
    aging,
    stale,
    rental,
    sale,
    projectCount,
    brokerCount,
    projects,
    brokers,
    groups,
    lastBatch,
  ] = await Promise.all([
    inv.countDocuments(activeFilter),
    inv.countDocuments({ ...activeFilter, freshnessStatus: 'FRESH' as BrokerFreshnessStatus }),
    inv.countDocuments({ ...activeFilter, freshnessStatus: 'AGING' as BrokerFreshnessStatus }),
    inv.countDocuments({ ...activeFilter, freshnessStatus: 'STALE' as BrokerFreshnessStatus }),
    inv.countDocuments({ ...activeFilter, transactionType: 'RENT' }),
    inv.countDocuments({ ...activeFilter, transactionType: 'SALE' }),
    inv.distinct('projectName', { ...activeFilter, projectName: { $exists: true, $ne: '' } }).then((v) => v.length),
    inv.distinct('brokerName', { ...activeFilter, brokerName: { $exists: true, $ne: '' } }).then((v) => v.length),
    topField('projectName'),
    topField('brokerName'),
    topField('groupName'),
    db
      .collection<OpsBrokerImportBatch>(BROKER_BATCHES_COLLECTION)
      .find({ importStatus: { $in: ['COMPLETED', 'PARTIAL', 'COMPLETED_WITH_ERRORS', 'DUPLICATE_FILE'] as BrokerImportStatus[] } })
      .sort({ uploadedAt: -1 })
      .limit(1)
      .toArray(),
  ]);

  return {
    totalActive,
    fresh,
    aging,
    stale,
    rental,
    sale,
    uniqueProjects: projectCount,
    uniqueBrokers: brokerCount,
    lastImportAt: lastBatch[0]?.uploadedAt ?? null,
    projects,
    brokers,
    groups,
  };
}
