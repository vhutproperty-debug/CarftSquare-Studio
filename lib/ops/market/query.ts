import type { Db } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { listProspects } from '@/lib/ops/calls/prospect-store';
import { listAllDemandRecords } from '@/lib/ops/demand/store';
import { demandKey } from '@/lib/ops/demand/types';
import { LEAD_SOURCE_ADAPTERS } from '@/lib/ops/leads/adapters';
import { runAdapterSafely } from '@/lib/ops/leads/adapters/shared';
import type { NormalizedOpsLead } from '@/lib/ops/leads/types';
import { listSupplyRecords } from '@/lib/ops/supply/store';
import {
  demandToRequirement,
  prospectToFlat,
  prospectToRequirement,
  supplyToFlat,
} from '@/lib/ops/market/adapt';
import { buildMarketOverview } from '@/lib/ops/market/match';
import { brokerRecordsToMarketRequirements } from '@/lib/ops/broker-crm/market';
import { listBrokerCrmForMarket } from '@/lib/ops/broker-crm/store';
import type { MarketFlat, MarketOverview, MarketRequirement } from '@/lib/ops/market/types';

async function loadRecentLeads(db: Db): Promise<NormalizedOpsLead[]> {
  const settled = await Promise.all(
    LEAD_SOURCE_ADAPTERS.map((adapter) => runAdapterSafely(
      adapter.source,
      () => adapter.fetchLeads(db, { limit: 500 }),
      [] as NormalizedOpsLead[],
    )),
  );
  return settled.flatMap((result) => result.value);
}

export async function queryMarketOverview(db?: Db): Promise<MarketOverview> {
  const database = db || await getDb();
  const [supplies, demands, prospects, leads] = await Promise.all([
    listSupplyRecords(database),
    listAllDemandRecords(database),
    listProspects(database, { isAdminViewAll: true, limit: 2000 }),
    loadRecentLeads(database),
  ]);

  const leadByKey = new Map(leads.map((lead) => [demandKey(lead.source, lead.sourceId), lead]));
  const linkedProspects = new Set(supplies.map((record) => record.prospectId).filter((id): id is string => Boolean(id)));

  const flats: MarketFlat[] = [];
  for (const record of supplies) {
    const flat = supplyToFlat(record);
    if (flat) flats.push(flat);
  }
  for (const prospect of prospects) {
    if (linkedProspects.has(prospect.id)) continue;
    const flat = prospectToFlat(prospect);
    if (flat) flats.push(flat);
  }

  const requirements: MarketRequirement[] = [];
  const seenDemand = new Set<string>();
  for (const demand of demands) {
    const key = demandKey(demand.source, demand.sourceId);
    seenDemand.add(key);
    const requirement = demandToRequirement(demand, leadByKey.get(key));
    if (requirement) requirements.push(requirement);
  }
  for (const lead of leads) {
    const key = demandKey(lead.source, lead.sourceId);
    if (seenDemand.has(key)) continue;
    const requirement = demandToRequirement({
      source: lead.source,
      sourceId: lead.sourceId,
      status: 'NEW',
      qualification: {},
    }, lead);
    if (requirement) requirements.push(requirement);
  }
  for (const prospect of prospects) {
    const requirement = prospectToRequirement(prospect);
    if (requirement) requirements.push(requirement);
  }
  requirements.push(...await loadBrokerDemand(database));

  return buildMarketOverview(flats, requirements);
}

async function loadBrokerDemand(db: Db): Promise<MarketRequirement[]> {
  try {
    const records = await listBrokerCrmForMarket(db);
    return brokerRecordsToMarketRequirements(records);
  } catch (error) {
    console.error('[ops-market] broker_demand_failed', error instanceof Error ? error.message : error);
    return [];
  }
}

export { getDb as getDatabase };
