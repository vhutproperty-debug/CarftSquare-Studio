import type { Filter } from 'mongodb';
import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import { ensureKnowledgeGraphIndexes } from '@/lib/research/graph/indexes';
import type { KgAdvancedSearchQuery, KgChange, KgProperty } from '@/lib/research/graph/types';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';

/**
 * Parse natural advanced-search phrases into structured KG queries.
 */
export function parseAdvancedKnowledgeQuery(
  message: string,
  workspaceId: string,
): KgAdvancedSearchQuery | null {
  const text = message.trim().toLowerCase();
  const q: KgAdvancedSearchQuery = { workspaceId, limit: 50 };
  let matched = false;

  if (/price\s+drops?|price\s+reduced|dropped\s+price|reduction/i.test(text)) {
    q.priceDrops = true;
    matched = true;
  }
  if (/price\s+increas|price\s+hiked|price\s+up/i.test(text)) {
    q.priceIncreases = true;
    matched = true;
  }
  const days = text.match(
    /(?:more than|over|>\s*)(\d+)\s*days?(?:\s+on\s+market)?|active for more than (\d+) days/i,
  );
  if (days) {
    q.minDaysOnMarket = Number(days[1] || days[2]);
    matched = true;
  }
  if (/broker[-\s]?exclusive|exclusive inventory/i.test(text)) {
    q.brokerExclusive = true;
    matched = true;
  }
  if (/newly\s+listed|new listings?|listed (today|this week)/i.test(text)) {
    q.newlyListedDays = /today/.test(text) ? 1 : 7;
    matched = true;
  }
  const portals = text.match(
    /(?:seen on|listed on|available on)\s+(\d+)\s*(?:or more\s+)?portals?|(\d+)\s*(?:or more\s+)?portals?/i,
  );
  if (portals) {
    q.minPortals = Number(portals[1] || portals[2]);
    matched = true;
  }
  if (/removed this week|delisted this week|taken down/i.test(text)) {
    q.removedSinceDays = 7;
    matched = true;
  }
  if (/removed|delisted/.test(text) && !q.removedSinceDays) {
    q.status = 'removed';
    matched = true;
  }
  if (/re-?listed|reappeared/i.test(text)) {
    q.relisted = true;
    matched = true;
  }
  if (/multiple brokers|more than one broker|two brokers|several brokers/i.test(text)) {
    q.multipleBrokers = true;
    matched = true;
  }
  if (/increasing inventory|inventory (is )?growing|inventory trend up/i.test(text)) {
    q.increasingInventoryProjects = true;
    matched = true;
  }

  if (!matched) return null;
  return q;
}

export async function advancedKnowledgeSearch(
  query: KgAdvancedSearchQuery,
): Promise<KgProperty[]> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  await ensureKnowledgeGraphIndexes(db);

  const filter: Filter<KgProperty> = { workspaceId: query.workspaceId };
  if (query.status) filter.status = query.status;
  else if (!query.removedSinceDays) filter.status = 'active';

  if (query.minDaysOnMarket != null || query.maxDaysOnMarket != null) {
    filter.daysOnMarket = {
      ...(query.minDaysOnMarket != null ? { $gte: query.minDaysOnMarket } : {}),
      ...(query.maxDaysOnMarket != null ? { $lte: query.maxDaysOnMarket } : {}),
    };
  }
  if (query.brokerExclusive) {
    filter.portalKeys = { $size: 1 };
  }
  if (query.minPortals != null) {
    filter[`portalKeys.${query.minPortals - 1}`] = { $exists: true };
  }
  if (query.newlyListedDays != null) {
    const since = new Date(
      Date.now() - query.newlyListedDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    filter.firstSeenAt = { $gte: since };
  }
  if (query.removedSinceDays != null) {
    const since = new Date(
      Date.now() - query.removedSinceDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    filter.status = 'removed';
    filter.updatedAt = { $gte: since };
  }
  if (query.bhk != null) filter.bhk = query.bhk;
  if (query.projectName) {
    filter.projectName = { $regex: query.projectName, $options: 'i' };
  }
  if (query.listedBy && query.listedBy !== 'any') {
    // Include legacy docs missing listedBy only when filtering for 'unknown'
    if (query.listedBy === 'unknown') {
      filter.$or = [
        { listedBy: 'unknown' },
        { listedBy: { $exists: false } },
      ];
    } else {
      filter.listedBy = query.listedBy;
    }
  }
  if (query.localityName?.trim()) {
    const localityRe = query.localityName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const localities = await db
      .collection(RESEARCH_COLLECTIONS.kgLocalities)
      .find({
        workspaceId: query.workspaceId,
        name: { $regex: localityRe, $options: 'i' },
      })
      .project({ id: 1 })
      .limit(50)
      .toArray();
    const localityIds = localities.map((l) => l.id as string);
    const localityClauses: Filter<KgProperty>[] = [
      { localityName: { $regex: localityRe, $options: 'i' } },
      { title: { $regex: localityRe, $options: 'i' } },
      { projectName: { $regex: localityRe, $options: 'i' } },
    ];
    if (localityIds.length) {
      localityClauses.push({ localityId: { $in: localityIds } });
    }
    const existingAnd = Array.isArray(filter.$and) ? filter.$and : [];
    filter.$and = [...existingAnd, { $or: localityClauses }];
  }

  if (query.increasingInventoryProjects) {
    const projects = await db
      .collection(RESEARCH_COLLECTIONS.kgProjects)
      .find({
        workspaceId: query.workspaceId,
        inventoryGrowthPct: { $gt: 0 },
      })
      .project({ id: 1 })
      .limit(50)
      .toArray();
    const ids = projects.map((p) => p.id as string);
    filter.projectId = { $in: ids };
  }

  let properties = await db
    .collection<KgProperty>(RESEARCH_COLLECTIONS.kgProperties)
    .find(filter)
    .sort({ lastSeenAt: -1 })
    .limit(query.limit || 50)
    .toArray();

  if (query.relisted) {
    const weekAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const changes = await db
      .collection<KgChange>(RESEARCH_COLLECTIONS.kgChanges)
      .find({
        workspaceId: query.workspaceId,
        type: 'listing_reappeared',
        detectedAt: { $gte: weekAgo },
      })
      .project({ propertyId: 1 })
      .toArray();
    const ids = new Set(changes.map((c) => c.propertyId));
    properties = properties.filter((p) => ids.has(p.id) || p.status === 'relisted');
  }

  if (query.multipleBrokers) {
    properties = properties.filter((p) => {
      const brokers = new Set(
        (p.brokerHistory || []).map((b) => b.brokerId || b.brokerName).filter(Boolean),
      );
      return brokers.size >= 2;
    });
  }

  if (query.priceDrops || query.priceIncreases) {
    const type = query.priceDrops ? 'price_dropped' : 'price_increased';
    const weekAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const changes = await db
      .collection<KgChange>(RESEARCH_COLLECTIONS.kgChanges)
      .find({
        workspaceId: query.workspaceId,
        type,
        detectedAt: { $gte: weekAgo },
      })
      .project({ propertyId: 1 })
      .toArray();
    const ids = new Set(changes.map((c) => c.propertyId));
    properties = properties.filter((p) => ids.has(p.id));
    if (!properties.length && ids.size) {
      properties = await db
        .collection<KgProperty>(RESEARCH_COLLECTIONS.kgProperties)
        .find({ workspaceId: query.workspaceId, id: { $in: [...ids] } })
        .limit(query.limit || 50)
        .toArray();
    }
  }

  return properties;
}
