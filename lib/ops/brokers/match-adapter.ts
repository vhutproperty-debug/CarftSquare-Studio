/**
 * Least-invasive matching boundary for broker-group inventory.
 *
 * Does NOT write into ops_supply_records or ops_matches on import.
 * Reuses computeMatchScore / MatchProfile from the existing matching engine
 * so demand can be scored against broker inventory without destabilizing
 * company-owned supply matching.
 *
 * Next integration step: optional "Promote to Supply" that creates a single
 * ops_supply_records row with source `broker_network` after human verification.
 */

import type { Db } from 'mongodb';
import { getDemandRecord } from '@/lib/ops/demand/store';
import { demandKey } from '@/lib/ops/demand/types';
import type { OpsDemandRecord } from '@/lib/ops/demand/types';
import { profileFromDemand } from '@/lib/ops/matching/profiles';
import { computeMatchScore, MIN_MATCH_SCORE } from '@/lib/ops/matching/scorer';
import type { MatchProfile } from '@/lib/ops/matching/types';
import type { NormalizedOpsLead, OpsLeadSource } from '@/lib/ops/leads/types';
import {
  BROKER_INVENTORY_COLLECTION,
  ensureBrokerIndexes,
  getDatabase,
  getInventoryById,
  getRawMessagesByIds,
} from '@/lib/ops/brokers/store';
import type { BrokerDemandMatchHit, OpsBrokerInventory } from '@/lib/ops/brokers/types';

function profileFromBrokerInventory(item: OpsBrokerInventory): MatchProfile {
  const transactionType =
    item.transactionType === 'RENT' ? 'rent' : item.transactionType === 'SALE' ? 'buy' : undefined;

  return {
    transactionType,
    budget: item.transactionType === 'SALE' ? item.salePrice ?? null : item.rent ?? null,
    configuration: (item.configuration || (item.bhk != null ? `${item.bhk}bhk` : '')).toLowerCase(),
    project: (item.projectNormalized || item.projectName || '').toLowerCase(),
    building: (item.tower || item.wing || '').toLowerCase(),
    furnishing: (item.furnishing || '').toLowerCase().replace(/_/g, ' '),
    parking: (item.parking || '').toLowerCase(),
    timeline: (item.availability || item.availableFrom || '').toLowerCase(),
    areaPreference: (item.projectName || '').toLowerCase(),
    notes: (item.notes || '').toLowerCase(),
  };
}

function stubLeadFromDemand(demand: OpsDemandRecord): NormalizedOpsLead {
  return {
    source: demand.source,
    sourceId: demand.sourceId,
    sourceCollection: 'ops_demand_records',
    createdAt: demand.createdAt,
    updatedAt: demand.updatedAt,
    category: 'rental',
    projectName: demand.qualification?.preferredBuildings,
    requirement: demand.qualification?.bhk,
    budget: demand.qualification?.budget,
    location: demand.qualification?.preferredBuildings,
    intent: demand.qualification?.rentBuy,
  };
}

export async function matchDemandAgainstBrokerInventory(input: {
  demandKey?: string;
  demandSource?: string;
  demandSourceId?: string;
  limit?: number;
}): Promise<BrokerDemandMatchHit[]> {
  const db: Db = await getDatabase();
  await ensureBrokerIndexes(db);

  let source = input.demandSource as OpsLeadSource | undefined;
  let sourceId = input.demandSourceId;

  if (input.demandKey && (!source || !sourceId)) {
    const idx = input.demandKey.indexOf(':');
    if (idx > 0) {
      source = input.demandKey.slice(0, idx) as OpsLeadSource;
      sourceId = input.demandKey.slice(idx + 1);
    }
  }

  if (!source || !sourceId) {
    throw new Error('demandKey or demandSource + demandSourceId is required.');
  }

  const demand = await getDemandRecord(db, source, sourceId);
  if (!demand) {
    throw new Error('Demand record not found.');
  }

  const demandProfile = profileFromDemand(stubLeadFromDemand(demand), demand);

  const inventory = await db
    .collection<OpsBrokerInventory>(BROKER_INVENTORY_COLLECTION)
    .find({ status: 'ACTIVE', freshnessStatus: { $in: ['FRESH', 'AGING'] } })
    .sort({ lastSeenAt: -1 })
    .limit(500)
    .toArray();

  const hits: BrokerDemandMatchHit[] = [];

  for (const item of inventory) {
    const supplyProfile = profileFromBrokerInventory(item);
    const { score, reasons } = computeMatchScore(demandProfile, supplyProfile);
    if (score < MIN_MATCH_SCORE) continue;
    hits.push({
      inventoryId: item.id,
      score,
      reasons,
      inventory: item,
    });
  }

  hits.sort((a, b) => b.score - a.score);
  const limited = hits.slice(0, input.limit || 20);

  const latestIds = limited
    .map((hit) => hit.inventory.sourceMessageIds[hit.inventory.sourceMessageIds.length - 1])
    .filter((id): id is string => Boolean(id));
  const msgs = await getRawMessagesByIds(db, latestIds);
  const byId = new Map(msgs.map((m) => [m.id, m.rawMessage]));
  for (const hit of limited) {
    const latestId = hit.inventory.sourceMessageIds[hit.inventory.sourceMessageIds.length - 1];
    if (latestId) hit.latestRawMessage = byId.get(latestId);
  }

  return limited;
}

export async function matchInventoryAgainstReadyDemand(
  inventoryId: string,
  limit = 20,
): Promise<Array<{ demandKey: string; score: number; reasons: string[]; demand: OpsDemandRecord }>> {
  const db: Db = await getDatabase();
  const inventory = await getInventoryById(db, inventoryId);
  if (!inventory) throw new Error('Broker inventory not found.');

  const supplyProfile = profileFromBrokerInventory(inventory);

  const demands = await db
    .collection<OpsDemandRecord>('ops_demand_records')
    .find({ status: 'READY_FOR_MATCHING' })
    .limit(300)
    .toArray();

  const results: Array<{
    demandKey: string;
    score: number;
    reasons: string[];
    demand: OpsDemandRecord;
  }> = [];

  for (const demand of demands) {
    const demandProfile = profileFromDemand(stubLeadFromDemand(demand), demand);
    const { score, reasons } = computeMatchScore(demandProfile, supplyProfile);
    if (score < MIN_MATCH_SCORE) continue;
    results.push({
      demandKey: demandKey(demand.source, demand.sourceId),
      score,
      reasons,
      demand,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

export const BROKER_TO_SUPPLY_INTEGRATION_NOTES = `
Promote broker inventory → ops_supply_records:
- source: broker_network (existing enum)
- map project/configuration/rent/sale/furnishing/parking
- keep full provenance on ops_broker_inventory (never discard)
- set readyForMatching only after human verification
- never bulk-create supply rows on every WhatsApp import
` as const;
