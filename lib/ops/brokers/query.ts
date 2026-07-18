import type { Filter } from 'mongodb';
import type { BrokerInventoryQueueQuery } from '@/lib/ops/brokers/schemas';
import { listInventoryHistory } from '@/lib/ops/brokers/history';
import { countPendingReviews } from '@/lib/ops/brokers/review';
import {
  getDatabase,
  getInventoryById,
  getRawMessagesByIds,
  getWorkspaceAggregates,
  listInventory,
} from '@/lib/ops/brokers/store';
import type {
  BrokerInventoryQueueItem,
  BrokerWorkspaceResult,
  OpsBrokerInventory,
  OpsBrokerInventoryHistory,
  OpsBrokerRawMessage,
} from '@/lib/ops/brokers/types';
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function queryBrokerWorkspace(
  query: BrokerInventoryQueueQuery,
): Promise<BrokerWorkspaceResult> {
  const db = await getDatabase();
  const filter: Filter<OpsBrokerInventory> = {};

  const status = query.status && query.status !== 'all' ? query.status : 'ACTIVE';
  filter.status = status;

  if (query.freshness && query.freshness !== 'all') {
    filter.freshnessStatus = query.freshness;
  }
  if (query.transactionType && query.transactionType !== 'all') {
    filter.transactionType = query.transactionType;
  }
  if (query.furnishing && query.furnishing !== 'all') {
    filter.furnishing = query.furnishing;
  }
  if (query.project?.trim()) {
    filter.projectName = { $regex: escapeRegex(query.project.trim()), $options: 'i' };
  }
  if (query.broker?.trim()) {
    filter.brokerName = { $regex: escapeRegex(query.broker.trim()), $options: 'i' };
  }
  if (query.group?.trim()) {
    filter.groupName = { $regex: escapeRegex(query.group.trim()), $options: 'i' };
  }
  if (query.bhk?.trim()) {
    const n = Number(query.bhk);
    if (Number.isFinite(n)) filter.bhk = n;
    else filter.configuration = { $regex: escapeRegex(query.bhk.trim()), $options: 'i' };
  }
  if (query.search?.trim()) {
    const q = escapeRegex(query.search.trim());
    filter.$or = [
      { projectName: { $regex: q, $options: 'i' } },
      { brokerName: { $regex: q, $options: 'i' } },
      { groupName: { $regex: q, $options: 'i' } },
      { configuration: { $regex: q, $options: 'i' } },
      { tower: { $regex: q, $options: 'i' } },
      { unitNumber: { $regex: q, $options: 'i' } },
      { notes: { $regex: q, $options: 'i' } },
      { brokerPhone: { $regex: q, $options: 'i' } },
    ];
  }
  if (query.minConfidence != null || query.maxConfidence != null) {
    filter.overallConfidence = {};
    if (query.minConfidence != null) {
      (filter.overallConfidence as Record<string, number>).$gte = query.minConfidence;
    }
    if (query.maxConfidence != null) {
      (filter.overallConfidence as Record<string, number>).$lte = query.maxConfidence;
    }
  }

  const page = query.page || 1;
  const pageSize = query.pageSize || 25;
  const sort = query.sort || 'lastSeenAt';
  const sortDir = query.sortDir || 'desc';

  const [{ items, total }, aggregates, pendingReviews] = await Promise.all([
    listInventory(db, filter, { page, pageSize, sort, sortDir }),
    getWorkspaceAggregates(db),
    countPendingReviews(db),
  ]);

  // Attach latest message preview for table
  const latestIds = items
    .map((item) => item.sourceMessageIds[item.sourceMessageIds.length - 1])
    .filter(Boolean);
  const messages = await getRawMessagesByIds(db, latestIds);
  const messageMap = new Map(messages.map((m) => [m.id, m]));

  const queueItems: BrokerInventoryQueueItem[] = items.map((item) => {
    const latestId = item.sourceMessageIds[item.sourceMessageIds.length - 1];
    const latest = latestId ? messageMap.get(latestId) : undefined;
    const preview = latest?.rawMessage
      ? latest.rawMessage.replace(/\s+/g, ' ').slice(0, 120)
      : undefined;
    return { ...item, latestMessagePreview: preview };
  });

  return {
    items: queueItems,
    metrics: {
      totalActive: aggregates.totalActive,
      fresh: aggregates.fresh,
      aging: aggregates.aging,
      stale: aggregates.stale,
      rental: aggregates.rental,
      sale: aggregates.sale,
      uniqueProjects: aggregates.uniqueProjects,
      uniqueBrokers: aggregates.uniqueBrokers,
      lastImportAt: aggregates.lastImportAt,
      pendingReviews,
    },
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    filterOptions: {
      projects: aggregates.projects,
      brokers: aggregates.brokers,
      groups: aggregates.groups,
    },
  };
}

export async function getBrokerInventoryDetail(id: string): Promise<{
  inventory: OpsBrokerInventory;
  sourceMessages: OpsBrokerRawMessage[];
  changeHistory: OpsBrokerInventoryHistory[];
} | null> {
  const db = await getDatabase();
  const inventory = await getInventoryById(db, id);
  if (!inventory) return null;

  const [sourceMessages, changeHistory] = await Promise.all([
    getRawMessagesByIds(db, inventory.sourceMessageIds),
    listInventoryHistory(db, inventory.id, 100),
  ]);
  const byId = new Map(sourceMessages.map((m) => [m.id, m]));
  const ordered = inventory.sourceMessageIds
    .map((mid) => byId.get(mid))
    .filter((m): m is OpsBrokerRawMessage => Boolean(m));

  return { inventory, sourceMessages: ordered, changeHistory };
}
