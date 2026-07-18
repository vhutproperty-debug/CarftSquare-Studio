import type { Db } from 'mongodb';
import {
  buildInventoryRecord,
  createInventoryRecord,
  findInventoryByDedupeKey,
  getInventoryById,
  refreshInventoryRecord,
} from '@/lib/ops/brokers/store';
import { getReviewItem, updateReviewItem } from '@/lib/ops/brokers/review';
import type { OpsBrokerReviewItem } from '@/lib/ops/brokers/types';
import type { BrokerConfidenceBreakdown } from '@/lib/ops/brokers/types';

export async function resolveReviewItem(
  db: Db,
  input: {
    reviewId: string;
    action: 'approve_merge' | 'create_new' | 'ignore';
    actorId: string;
    actorEmail?: string;
  },
): Promise<OpsBrokerReviewItem> {
  const item = await getReviewItem(db, input.reviewId);
  if (!item) throw new Error('Review item not found.');
  if (item.status !== 'PENDING') throw new Error('Review item already resolved.');

  const now = new Date().toISOString();
  const proposed = item.proposed;
  const confidence = item.confidence as BrokerConfidenceBreakdown;

  if (input.action === 'ignore') {
    const updated = await updateReviewItem(db, item.id, {
      status: 'IGNORED',
      resolvedBy: input.actorId,
      resolvedAt: now,
    });
    return updated!;
  }

  if (input.action === 'approve_merge') {
    const existingId = item.existingInventoryId;
    const existing = existingId
      ? await getInventoryById(db, existingId)
      : await findInventoryByDedupeKey(db, item.dedupeKey);
    if (!existing) {
      throw new Error('No existing inventory found to merge into.');
    }
    await refreshInventoryRecord(db, existing, {
      sourceMessageId: item.rawMessageId,
      lastImportBatchId: item.batchId,
      lastSeenAt: now,
      lastMessageAt: now,
      ...proposed,
    });
    const updated = await updateReviewItem(db, item.id, {
      status: 'APPROVED_MERGE',
      resolvedBy: input.actorId,
      resolvedAt: now,
      resolutionInventoryId: existing.id,
    });
    return updated!;
  }

  // create_new — force a unique dedupe suffix so it does not collide
  const forcedKey = `${item.dedupeKey}|review:${item.id.slice(0, 8)}`;
  const created = await createInventoryRecord(
    db,
    buildInventoryRecord({
      extracted: proposed,
      dedupeKey: forcedKey,
      batchId: item.batchId,
      messageId: item.rawMessageId,
      groupName: item.groupName,
      brokerId: proposed.brokerId,
      brokerName: proposed.brokerName,
      brokerPhone: proposed.brokerPhone,
      originalSenderName: proposed.originalSenderName,
      originalSenderPhone: proposed.originalSenderPhone,
      seenAt: now,
      confidence,
      sourceType: 'BROKER_GROUP',
    }),
  );

  const updated = await updateReviewItem(db, item.id, {
    status: 'CREATED_NEW',
    resolvedBy: input.actorId,
    resolvedAt: now,
    resolutionInventoryId: created.id,
  });
  return updated!;
}
