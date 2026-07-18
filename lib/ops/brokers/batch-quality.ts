import type { Db } from 'mongodb';
import { countPendingReviews, listReviewQueue } from '@/lib/ops/brokers/review';
import { listUnknownProjects } from '@/lib/ops/brokers/normalize/project-aliases';
import {
  BROKER_INVENTORY_COLLECTION,
  BROKER_RAW_MESSAGES_COLLECTION,
  ensureBrokerIndexes,
  getImportBatch,
} from '@/lib/ops/brokers/store';
import type { BrokerBatchQualityDetail, OpsBrokerRawMessage } from '@/lib/ops/brokers/types';

export async function getBatchQualityDetail(
  db: Db,
  batchId: string,
): Promise<BrokerBatchQualityDetail | null> {
  await ensureBrokerIndexes(db);
  const batch = await getImportBatch(db, batchId);
  if (!batch) return null;

  const raw = db.collection(BROKER_RAW_MESSAGES_COLLECTION);
  const inv = db.collection(BROKER_INVENTORY_COLLECTION);

  const [
    malformedMessages,
    reviewItemsPage,
    unknownProjectList,
    reviewQueue,
    topBrokers,
    topProjects,
  ] = await Promise.all([
    raw
      .find({ batchId, parseStatus: 'MALFORMED' })
      .limit(50)
      .toArray()
      .then((rows) => rows as unknown as OpsBrokerRawMessage[]),
    listReviewQueue(db, { batchId, page: 1, pageSize: 50 }),
    listUnknownProjects(db, 50).then((rows) =>
      rows.filter((r) => r.batchId === batchId || !r.batchId),
    ),
    countPendingReviews(db, batchId),
    inv
      .aggregate<{ _id: string; count: number }>([
        { $match: { lastImportBatchId: batchId } },
        { $group: { _id: { $ifNull: ['$brokerName', 'Unknown'] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ])
      .toArray(),
    inv
      .aggregate<{ _id: string; count: number }>([
        { $match: { lastImportBatchId: batchId, projectName: { $exists: true, $ne: '' } } },
        { $group: { _id: '$projectName', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ])
      .toArray(),
  ]);

  return {
    batch,
    messagesParsed: batch.totalMessages,
    listingCandidates: batch.candidateListings,
    listingsExtracted: batch.listingsExtracted || 0,
    newInventory: batch.createdListings,
    updatedInventory: batch.updatedListings,
    reviewQueue,
    skipped: batch.skippedMessages || 0,
    malformed: batch.malformedMessages || malformedMessages.length,
    failed: batch.failedMessages,
    unknownProjects: batch.unknownProjects || unknownProjectList.length,
    averageConfidence: batch.averageConfidence || 0,
    topBrokers: topBrokers.map((r) => ({ name: r._id, count: r.count })),
    topProjects: topProjects.map((r) => ({ name: r._id, count: r.count })),
    malformedMessages,
    reviewItems: reviewItemsPage.items,
    unknownProjectList,
  };
}
