import { v4 as uuidv4 } from 'uuid';
import type { Db, Filter } from 'mongodb';
import { REVIEW_CONFIG } from '@/lib/ops/brokers/config';
import type {
  BrokerConfidenceBreakdown,
  OpsBrokerInventory,
  OpsBrokerReviewItem,
} from '@/lib/ops/brokers/types';
import type { BrokerReviewReason, BrokerReviewStatus } from '@/lib/ops/brokers/statuses';

export const BROKER_REVIEW_QUEUE_COLLECTION = 'ops_broker_review_queue';

export async function ensureReviewIndexes(db: Db): Promise<void> {
  await db.collection(BROKER_REVIEW_QUEUE_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(BROKER_REVIEW_QUEUE_COLLECTION).createIndex({ status: 1, createdAt: -1 });
  await db.collection(BROKER_REVIEW_QUEUE_COLLECTION).createIndex({ batchId: 1 });
  await db.collection(BROKER_REVIEW_QUEUE_COLLECTION).createIndex(
    { rawMessageId: 1 },
    { unique: true },
  );
  await db.collection(BROKER_REVIEW_QUEUE_COLLECTION).createIndex({ dedupeKey: 1, status: 1 });
}

export function decideReviewRouting(input: {
  confidence: BrokerConfidenceBreakdown;
  dedupeConfidence: number;
  existing?: OpsBrokerInventory | null;
  projectMapped?: boolean;
  hasConflictingRent?: boolean;
  hasConflictingConfiguration?: boolean;
  malformed?: boolean;
}): { action: 'auto_merge' | 'auto_create' | 'review'; reasons: BrokerReviewReason[] } {
  const reasons: BrokerReviewReason[] = [];

  if (input.malformed) reasons.push('malformed_listing');
  if (!input.projectMapped) reasons.push('unknown_project');
  if (input.hasConflictingRent) reasons.push('conflicting_rent');
  if (input.hasConflictingConfiguration) reasons.push('conflicting_configuration');
  if (input.confidence.overallConfidence <= REVIEW_CONFIG.lowConfidenceMax) {
    reasons.push('low_confidence');
  }

  if (input.existing) {
    if (
      input.dedupeConfidence >= REVIEW_CONFIG.dedupeReviewMin
      && input.dedupeConfidence <= REVIEW_CONFIG.dedupeReviewMax
    ) {
      reasons.push('duplicate_uncertainty');
    }

    if (
      reasons.length === 0
      && input.dedupeConfidence >= REVIEW_CONFIG.dedupeAutoMergeMin
      && input.confidence.overallConfidence >= REVIEW_CONFIG.autoMergeMinOverall
    ) {
      return { action: 'auto_merge', reasons: [] };
    }

    if (reasons.length > 0 || input.dedupeConfidence < REVIEW_CONFIG.dedupeAutoMergeMin) {
      if (!reasons.includes('duplicate_uncertainty') && input.dedupeConfidence < REVIEW_CONFIG.dedupeAutoMergeMin) {
        reasons.push('duplicate_uncertainty');
      }
      return { action: 'review', reasons };
    }

    return { action: 'auto_merge', reasons: [] };
  }

  // Create path
  if (
    reasons.length === 0
    && input.confidence.overallConfidence >= REVIEW_CONFIG.autoMergeMinOverall
  ) {
    return { action: 'auto_create', reasons: [] };
  }

  if (
    input.confidence.overallConfidence >= REVIEW_CONFIG.reviewBandMin
    && input.confidence.overallConfidence <= REVIEW_CONFIG.reviewBandMax
  ) {
    if (!reasons.includes('low_confidence')) reasons.push('low_confidence');
    return { action: 'review', reasons };
  }

  if (reasons.length > 0) {
    return { action: 'review', reasons };
  }

  return { action: 'auto_create', reasons: [] };
}

export async function enqueueReviewItem(
  db: Db,
  payload: Omit<OpsBrokerReviewItem, 'id' | 'createdAt' | 'updatedAt' | 'status'> & {
    status?: BrokerReviewStatus;
  },
): Promise<{ item: OpsBrokerReviewItem; created: boolean }> {
  await ensureReviewIndexes(db);
  const now = new Date().toISOString();
  const item: OpsBrokerReviewItem = {
    id: uuidv4(),
    status: payload.status || 'PENDING',
    reasons: payload.reasons,
    batchId: payload.batchId,
    groupName: payload.groupName,
    rawMessageId: payload.rawMessageId,
    dedupeKey: payload.dedupeKey,
    existingInventoryId: payload.existingInventoryId,
    proposed: payload.proposed,
    confidence: payload.confidence,
    dedupeConfidence: payload.dedupeConfidence,
    notes: payload.notes,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await db.collection(BROKER_REVIEW_QUEUE_COLLECTION).insertOne(item);
    return { item, created: true };
  } catch (err) {
    const code = typeof err === 'object' && err && 'code' in err ? (err as { code?: number }).code : undefined;
    if (code === 11000) {
      const existing = await db
        .collection<OpsBrokerReviewItem>(BROKER_REVIEW_QUEUE_COLLECTION)
        .findOne({ rawMessageId: payload.rawMessageId });
      if (existing) return { item: existing, created: false };
    }
    throw err;
  }
}

export async function listReviewQueue(
  db: Db,
  opts: { status?: BrokerReviewStatus; page: number; pageSize: number; batchId?: string },
): Promise<{ items: OpsBrokerReviewItem[]; total: number }> {
  await ensureReviewIndexes(db);
  const filter: Filter<OpsBrokerReviewItem> = {};
  if (opts.status) filter.status = opts.status;
  if (opts.batchId) filter.batchId = opts.batchId;
  const col = db.collection<OpsBrokerReviewItem>(BROKER_REVIEW_QUEUE_COLLECTION);
  const total = await col.countDocuments(filter);
  const items = await col
    .find(filter)
    .sort({ createdAt: -1 })
    .skip((opts.page - 1) * opts.pageSize)
    .limit(opts.pageSize)
    .toArray();
  return { items, total };
}

export async function getReviewItem(db: Db, id: string): Promise<OpsBrokerReviewItem | null> {
  await ensureReviewIndexes(db);
  return db.collection<OpsBrokerReviewItem>(BROKER_REVIEW_QUEUE_COLLECTION).findOne({ id });
}

export async function updateReviewItem(
  db: Db,
  id: string,
  patch: Partial<OpsBrokerReviewItem>,
): Promise<OpsBrokerReviewItem | null> {
  await ensureReviewIndexes(db);
  const updatedAt = new Date().toISOString();
  await db.collection(BROKER_REVIEW_QUEUE_COLLECTION).updateOne(
    { id },
    { $set: { ...patch, updatedAt } },
  );
  return getReviewItem(db, id);
}

export async function countPendingReviews(db: Db, batchId?: string): Promise<number> {
  await ensureReviewIndexes(db);
  const filter: Filter<OpsBrokerReviewItem> = { status: 'PENDING' };
  if (batchId) filter.batchId = batchId;
  return db.collection(BROKER_REVIEW_QUEUE_COLLECTION).countDocuments(filter);
}
