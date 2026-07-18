import type { Db } from 'mongodb';
import { BROKER_INVENTORY_COLLECTION, ensureBrokerIndexes } from '@/lib/ops/brokers/store';
import { UNKNOWN_PROJECTS_COLLECTION } from '@/lib/ops/brokers/normalize/project-aliases';
import type { BrokerAnalyticsResult } from '@/lib/ops/brokers/types';

export async function queryBrokerAnalytics(db: Db): Promise<BrokerAnalyticsResult> {
  await ensureBrokerIndexes(db);
  const inv = db.collection(BROKER_INVENTORY_COLLECTION);

  const [
    topBrokers,
    topGroups,
    freshnessRows,
    topProjects,
    rentVsSaleRows,
    repostAgg,
    activityTrend,
    ageBuckets,
    unknownProjects,
  ] = await Promise.all([
    inv
      .aggregate<{ _id: string; count: number; brokerId?: string }>([
        { $match: { status: 'ACTIVE' } },
        {
          $group: {
            _id: { $ifNull: ['$brokerName', 'Unknown'] },
            count: { $sum: 1 },
            brokerId: { $first: '$brokerId' },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ])
      .toArray(),
    inv
      .aggregate<{ _id: string; count: number }>([
        { $match: { status: 'ACTIVE' } },
        { $group: { _id: '$groupName', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ])
      .toArray(),
    inv
      .aggregate<{ _id: string; count: number }>([
        { $match: { status: 'ACTIVE' } },
        { $group: { _id: '$freshnessStatus', count: { $sum: 1 } } },
      ])
      .toArray(),
    inv
      .aggregate<{ _id: string; count: number }>([
        { $match: { status: 'ACTIVE', projectName: { $exists: true, $ne: '' } } },
        { $group: { _id: '$projectName', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ])
      .toArray(),
    inv
      .aggregate<{ _id: string; count: number }>([
        { $match: { status: 'ACTIVE' } },
        { $group: { _id: '$transactionType', count: { $sum: 1 } } },
      ])
      .toArray(),
    inv
      .aggregate<{ avg: number }>([
        { $match: { status: 'ACTIVE' } },
        { $group: { _id: null, avg: { $avg: '$occurrenceCount' } } },
      ])
      .toArray(),
    inv
      .aggregate<{ _id: string; count: number }>([
        { $match: { status: 'ACTIVE', lastSeenAt: { $exists: true } } },
        {
          $group: {
            _id: { $substr: ['$lastSeenAt', 0, 10] },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: -1 } },
        { $limit: 30 },
      ])
      .toArray(),
    inv
      .aggregate<{ _id: string; count: number }>([
        { $match: { status: 'ACTIVE' } },
        {
          $project: {
            ageDays: {
              $divide: [
                { $subtract: [new Date(), { $toDate: '$lastSeenAt' }] },
                1000 * 60 * 60 * 24,
              ],
            },
          },
        },
        {
          $bucket: {
            groupBy: '$ageDays',
            boundaries: [0, 3, 7, 14, 30, 60, 9999],
            default: '60+',
            output: { count: { $sum: 1 } },
          },
        },
      ])
      .toArray()
      .catch(() => []),
    db
      .collection(UNKNOWN_PROJECTS_COLLECTION)
      .find({})
      .sort({ count: -1 })
      .limit(20)
      .toArray(),
  ]);

  const freshnessMap = Object.fromEntries(freshnessRows.map((r) => [r._id, r.count]));
  const txnMap = Object.fromEntries(rentVsSaleRows.map((r) => [r._id, r.count]));

  const bucketLabels: Record<string | number, string> = {
    0: '0–3d',
    3: '3–7d',
    7: '7–14d',
    14: '14–30d',
    30: '30–60d',
    '60+': '60d+',
  };

  return {
    topBrokers: topBrokers.map((r) => ({
      brokerId: r.brokerId,
      brokerName: r._id,
      count: r.count,
    })),
    topGroups: topGroups.map((r) => ({ groupName: r._id, count: r.count })),
    freshness: {
      fresh: freshnessMap.FRESH || 0,
      aging: freshnessMap.AGING || 0,
      stale: freshnessMap.STALE || 0,
    },
    topProjects: topProjects.map((r) => ({ project: r._id, count: r.count })),
    rentVsSale: {
      rent: txnMap.RENT || 0,
      sale: txnMap.SALE || 0,
      unknown: txnMap.UNKNOWN || 0,
    },
    averageRepostFrequency: Number((repostAgg[0]?.avg || 1).toFixed(2)),
    brokerActivityTrend: activityTrend
      .slice()
      .reverse()
      .map((r) => ({ day: r._id, count: r.count })),
    inventoryAgeDistribution: (ageBuckets as Array<{ _id: string | number; count: number }>).map(
      (r) => ({
        bucket: bucketLabels[r._id] || String(r._id),
        count: r.count,
      }),
    ),
    unknownProjectTrends: unknownProjects.map((u) => ({
      projectName: String((u as { projectName?: string }).projectName || ''),
      count: Number((u as { count?: number }).count || 0),
    })),
  };
}
