import type { Filter } from 'mongodb';
import type { AssistantSearchState, AssistantListingSource } from '@/lib/ops/brokers/assistant/types';
import {
  BROKER_INVENTORY_COLLECTION,
  BROKER_RAW_MESSAGES_COLLECTION,
  ensureBrokerIndexes,
  getDatabase,
  getRawMessagesByIds,
  listInventory,
} from '@/lib/ops/brokers/store';
import { loadAliasMap, normalizeProjectNameWithMap } from '@/lib/ops/brokers/normalize/project-aliases';
import type { OpsBrokerInventory } from '@/lib/ops/brokers/types';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function startOfDayIso(daysAgo = 0): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

function endOfDayIso(daysAgo = 0): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

/**
 * Indexed inventory search for the AI assistant.
 * Reuses the same Mongo collections/indexes as the Inventory tab — does not scan via AI.
 */
export async function searchInventoryForAssistant(
  state: AssistantSearchState,
): Promise<{ total: number; sources: AssistantListingSource[] }> {
  const db = await getDatabase();
  await ensureBrokerIndexes(db);

  const filter: Filter<OpsBrokerInventory> = { status: 'ACTIVE' };
  const and: Filter<OpsBrokerInventory>[] = [];

  if (state.freshness && state.freshness !== 'all') {
    filter.freshnessStatus = state.freshness;
  }
  if (state.transactionType && state.transactionType !== 'all') {
    filter.transactionType = state.transactionType;
  }
  if (state.furnishing && state.furnishing !== 'all') {
    filter.furnishing = state.furnishing;
  }
  if (state.broker?.trim()) {
    filter.brokerName = { $regex: escapeRegex(state.broker.trim()), $options: 'i' };
  }
  if (state.group?.trim()) {
    filter.groupName = { $regex: escapeRegex(state.group.trim()), $options: 'i' };
  }
  if (state.bhk?.trim()) {
    const n = Number(state.bhk);
    if (Number.isFinite(n)) filter.bhk = n;
    else filter.configuration = { $regex: escapeRegex(state.bhk.trim()), $options: 'i' };
  }

  // Project + aliases
  if (state.project?.trim()) {
    const aliasMap = await loadAliasMap(db);
    const normalized = normalizeProjectNameWithMap(state.project.trim(), aliasMap);
    const canonical = normalized.projectName || state.project.trim();
    const projectKey = normalized.projectNormalized || canonical.toLowerCase();
    and.push({
      $or: [
        { projectName: { $regex: escapeRegex(canonical), $options: 'i' } },
        { projectNormalized: { $regex: escapeRegex(projectKey), $options: 'i' } },
        { projectName: { $regex: escapeRegex(state.project.trim()), $options: 'i' } },
      ],
    });
  }

  if (state.locality?.trim()) {
    and.push({
      $or: [
        { projectName: { $regex: escapeRegex(state.locality.trim()), $options: 'i' } },
        { notes: { $regex: escapeRegex(state.locality.trim()), $options: 'i' } },
        { groupName: { $regex: escapeRegex(state.locality.trim()), $options: 'i' } },
      ],
    });
  }

  if (state.search?.trim() && !state.project?.trim()) {
    const q = escapeRegex(state.search.trim());
    and.push({
      $or: [
        { projectName: { $regex: q, $options: 'i' } },
        { brokerName: { $regex: q, $options: 'i' } },
        { groupName: { $regex: q, $options: 'i' } },
        { configuration: { $regex: q, $options: 'i' } },
        { tower: { $regex: q, $options: 'i' } },
        { wing: { $regex: q, $options: 'i' } },
        { unitNumber: { $regex: q, $options: 'i' } },
        { notes: { $regex: q, $options: 'i' } },
        { brokerPhone: { $regex: q, $options: 'i' } },
      ],
    });
  }

  if (state.minRent != null || state.maxRent != null) {
    const rent: Record<string, number> = {};
    if (state.minRent != null) rent.$gte = state.minRent;
    if (state.maxRent != null) rent.$lte = state.maxRent;
    filter.rent = rent;
  }
  if (state.minSalePrice != null || state.maxSalePrice != null) {
    const sale: Record<string, number> = {};
    if (state.minSalePrice != null) sale.$gte = state.minSalePrice;
    if (state.maxSalePrice != null) sale.$lte = state.maxSalePrice;
    filter.salePrice = sale;
  }

  if (state.minConfidence != null || state.maxConfidence != null) {
    const conf: Record<string, number> = {};
    if (state.minConfidence != null) conf.$gte = state.minConfidence;
    if (state.maxConfidence != null) conf.$lte = state.maxConfidence;
    filter.overallConfidence = conf;
  }

  if (state.postedSince === 'today') {
    filter.lastSeenAt = { $gte: startOfDayIso(0) };
  } else if (state.postedSince === 'yesterday') {
    filter.lastSeenAt = { $gte: startOfDayIso(1), $lte: endOfDayIso(1) };
  } else if (state.postedSince === '7d') {
    filter.lastSeenAt = { $gte: startOfDayIso(7) };
  }

  // WhatsApp keyword → message ids (listing candidates only), then inventory by sourceMessageIds
  if (state.messageKeyword?.trim()) {
    const kw = escapeRegex(state.messageKeyword.trim());
    const messageIds = await db
      .collection(BROKER_RAW_MESSAGES_COLLECTION)
      .find(
        { listingCandidate: true, rawMessage: { $regex: kw, $options: 'i' } },
        { projection: { id: 1 } },
      )
      .sort({ messageTimestamp: -1 })
      .limit(400)
      .toArray();
    const ids = messageIds.map((m) => String(m.id));
    if (!ids.length) {
      return { total: 0, sources: [] };
    }
    and.push({ sourceMessageIds: { $in: ids } });
  }

  if (and.length) {
    filter.$and = and;
  }

  const page = state.page || 1;
  const pageSize = Math.min(state.pageSize || 20, 40);
  const { items, total } = await listInventory(db, filter, {
    page,
    pageSize,
    sort: 'lastSeenAt',
    sortDir: 'desc',
  });

  const latestIds = items
    .map((item) => item.sourceMessageIds[item.sourceMessageIds.length - 1])
    .filter(Boolean);
  const messages = await getRawMessagesByIds(db, latestIds);
  const messageMap = new Map(messages.map((m) => [m.id, m]));

  const sources: AssistantListingSource[] = items.map((inventory) => {
    const latestId = inventory.sourceMessageIds[inventory.sourceMessageIds.length - 1];
    return {
      inventory,
      latestMessage: latestId ? messageMap.get(latestId) : undefined,
    };
  });

  // Touch collection name so indexes stay intentional (inventory path)
  void BROKER_INVENTORY_COLLECTION;

  return { total, sources };
}
