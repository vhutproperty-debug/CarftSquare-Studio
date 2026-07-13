/**
 * Matching workspace — reads demand/supply (read-only), writes ops_matches only.
 */
import type { Db } from 'mongodb';
// @ts-expect-error JS module without types
import { getDb } from '@/lib/mongodb';
import { batchLatestMatchActivities } from '@/lib/ops/matching/activity-store';
import { profileFromDemand, profileFromSupply } from '@/lib/ops/matching/profiles';
import { computeMatchScore, MIN_MATCH_SCORE } from '@/lib/ops/matching/scorer';
import { MATCH_ACTIVITY_LABELS } from '@/lib/ops/matching/statuses';
import type {
  MatchDemandSummary,
  MatchGenerationResult,
  MatchQueueItem,
  MatchingWorkspaceMetrics,
  MatchingWorkspaceResult,
  OpsMatchRecord,
} from '@/lib/ops/matching/types';
import { assigneeInitials, buildSupplySummary } from '@/lib/ops/matching/types';
import type { MatchStatus } from '@/lib/ops/matching/statuses';
import {
  createMatchRecord,
  getMatchByPair,
  getMatchRecord,
  listMatchRecords,
  updateMatchRecord,
} from '@/lib/ops/matching/store';
import { listAllDemandRecords } from '@/lib/ops/demand/store';
import { demandKey } from '@/lib/ops/demand/types';
import type { OpsDemandRecord } from '@/lib/ops/demand/types';
import { listSupplyRecords, getSupplyRecord } from '@/lib/ops/supply/store';
import type { OpsSupplyRecord } from '@/lib/ops/supply/types';
import { fetchUnifiedLeadBySourceId } from '@/lib/ops/leads/query';
import { listOpsTeamMembers } from '@/lib/ops/calls/query';
import type { PublicAdminUser } from '@/lib/auth/rbac/types';

export type MatchingWorkspaceQueryParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  project?: string;
  broker?: string;
  configuration?: string;
  listingType?: 'rent' | 'sale';
  minScore?: number;
  status?: MatchStatus;
  assignedBroker?: string;
  dateFrom?: string;
  dateTo?: string;
  mineOnly?: boolean;
};

export async function getEligibleDemandRecords(db: Db): Promise<OpsDemandRecord[]> {
  const records = await listAllDemandRecords(db);
  return records.filter((r) => r.status === 'READY_FOR_MATCHING');
}

export async function getEligibleSupplyRecords(db: Db): Promise<OpsSupplyRecord[]> {
  const records = await listSupplyRecords(db);
  return records.filter((r) => r.readyForMatching && r.status === 'AVAILABLE');
}

async function buildDemandSummary(db: Db, record: OpsDemandRecord): Promise<MatchDemandSummary | null> {
  const lead = await fetchUnifiedLeadBySourceId(record.source, record.sourceId, db);
  if (!lead) return null;
  return {
    key: demandKey(record.source, record.sourceId),
    source: record.source,
    sourceId: record.sourceId,
    name: lead.name,
    phone: lead.phone,
    projectName: lead.projectName,
    location: lead.location,
    requirement: lead.requirement || lead.intent,
    budget: record.qualification.budget || lead.budget,
    qualification: record.qualification,
    assignedToName: record.assignedToName,
  };
}

function matchesSearch(item: MatchQueueItem, search: string): boolean {
  const q = search.toLowerCase();
  const haystack = [
    item.demand.name,
    item.demand.projectName,
    item.demand.location,
    item.supply.label,
    item.supply.project,
    item.supply.building,
    item.match.notes,
  ].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(q);
}

function filterMatches(
  items: MatchQueueItem[],
  params: MatchingWorkspaceQueryParams,
  userId?: string,
): MatchQueueItem[] {
  return items.filter((item) => {
    if (params.search && !matchesSearch(item, params.search)) return false;
    if (params.project) {
      const p = params.project.toLowerCase();
      if (!(item.demand.projectName || '').toLowerCase().includes(p)
        && !(item.supply.project || '').toLowerCase().includes(p)) return false;
    }
    if (params.configuration) {
      const c = params.configuration.toLowerCase();
      if (!(item.demand.qualification.bhk || '').toLowerCase().includes(c)
        && !(item.supply.configuration || '').toLowerCase().includes(c)) return false;
    }
    if (params.listingType) {
      const type = params.listingType === 'rent' ? 'rent' : 'sale';
      const demandType = item.demand.qualification.rentBuy === 'buy' ? 'sale' : item.demand.qualification.rentBuy;
      if (demandType && demandType !== type && item.supply.listingType !== type) return false;
      if (item.supply.listingType && item.supply.listingType !== type) return false;
    }
    if (params.minScore != null && item.match.score < params.minScore) return false;
    if (params.status && item.match.status !== params.status) return false;
    if (params.broker && item.match.broker !== params.broker) return false;
    if (params.assignedBroker && item.match.broker !== params.assignedBroker) return false;
    if (params.mineOnly && userId && item.match.broker !== userId) return false;
    if (params.dateFrom && item.match.createdAt < new Date(params.dateFrom).toISOString()) return false;
    if (params.dateTo && item.match.createdAt > new Date(params.dateTo).toISOString()) return false;
    return true;
  });
}

export function computeMatchingMetrics(
  eligibleDemand: number,
  eligibleSupply: number,
  matches: OpsMatchRecord[],
): MatchingWorkspaceMetrics {
  return {
    eligibleDemand,
    eligibleSupply,
    suggestedMatches: matches.filter((m) => m.status === 'SUGGESTED').length,
    shortlisted: matches.filter((m) => m.status === 'SHORTLISTED').length,
    siteVisits: matches.filter((m) => m.status === 'SITE_VISIT_SCHEDULED').length,
    accepted: matches.filter((m) => m.status === 'ACCEPTED').length,
    rejected: matches.filter((m) => m.status === 'REJECTED').length,
    converted: matches.filter((m) => m.status === 'CONVERTED_TO_DEAL').length,
  };
}

export async function enrichMatchItems(db: Db, matches: OpsMatchRecord[]): Promise<MatchQueueItem[]> {
  const activityMap = await batchLatestMatchActivities(db, matches.map((m) => m.id));
  const items: MatchQueueItem[] = [];

  for (const match of matches) {
    const demandRecord = (await listAllDemandRecords(db)).find(
      (r) => demandKey(r.source, r.sourceId) === match.demandKey,
    );
    const supplyRecord = await getSupplyRecord(db, match.supplyId);
    if (!demandRecord || !supplyRecord) continue;

    const demand = await buildDemandSummary(db, demandRecord);
    if (!demand) continue;

    const latest = activityMap.get(match.id);
    items.push({
      id: match.id,
      match,
      demand,
      supply: buildSupplySummary(supplyRecord),
      lastActivityLabel: latest ? `${MATCH_ACTIVITY_LABELS[latest.type]} — ${latest.message}` : null,
      assigneeInitials: assigneeInitials(match.brokerName),
    });
  }

  return items;
}

export async function queryMatchingWorkspace(
  params: MatchingWorkspaceQueryParams,
  actor?: PublicAdminUser,
  db?: Db,
): Promise<MatchingWorkspaceResult> {
  const database = db || await getDb();
  const page = params.page || 1;
  const pageSize = params.pageSize || 25;

  const [eligibleDemand, eligibleSupply, allMatches] = await Promise.all([
    getEligibleDemandRecords(database),
    getEligibleSupplyRecords(database),
    listMatchRecords(database),
  ]);

  const enriched = await enrichMatchItems(database, allMatches);
  const filtered = filterMatches(enriched, params, actor?.id);
  filtered.sort((a, b) => b.match.score - a.match.score || b.match.updatedAt.localeCompare(a.match.updatedAt));

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const items = filtered.slice((page - 1) * pageSize, page * pageSize);

  return {
    items,
    pagination: { page, pageSize, total, totalPages },
    metrics: computeMatchingMetrics(eligibleDemand.length, eligibleSupply.length, allMatches),
  };
}

export async function generateMatches(
  options: { minScore?: number; demandKey?: string; supplyId?: string },
  actor: PublicAdminUser,
  db?: Db,
): Promise<MatchGenerationResult> {
  const database = db || await getDb();
  const minScore = options.minScore ?? MIN_MATCH_SCORE;

  let demandRecords = await getEligibleDemandRecords(database);
  let supplyRecords = await getEligibleSupplyRecords(database);

  if (options.demandKey) {
    demandRecords = demandRecords.filter((r) => demandKey(r.source, r.sourceId) === options.demandKey);
  }
  if (options.supplyId) {
    supplyRecords = supplyRecords.filter((r) => r.id === options.supplyId);
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let totalPairsEvaluated = 0;

  for (const demandRecord of demandRecords) {
    const lead = await fetchUnifiedLeadBySourceId(demandRecord.source, demandRecord.sourceId, database);
    if (!lead) {
      skipped += supplyRecords.length;
      continue;
    }

    const demandProfile = profileFromDemand(lead, demandRecord);
    const key = demandKey(demandRecord.source, demandRecord.sourceId);

    for (const supplyRecord of supplyRecords) {
      totalPairsEvaluated += 1;
      const supplyProfile = profileFromSupply(supplyRecord);
      const { score, reasons } = computeMatchScore(demandProfile, supplyProfile);

      if (score < minScore) {
        skipped += 1;
        continue;
      }

      const existing = await getMatchByPair(database, key, supplyRecord.id);
      if (existing) {
        if (existing.status !== 'SUGGESTED') {
          skipped += 1;
          continue;
        }
        if (existing.score !== score || JSON.stringify(existing.reasons) !== JSON.stringify(reasons)) {
          await updateMatchRecord(database, existing.id, {
            score,
            reasons,
            updatedBy: actor.id,
          });
          updated += 1;
        } else {
          skipped += 1;
        }
        continue;
      }

      await createMatchRecord(database, {
        demandKey: key,
        supplyId: supplyRecord.id,
        score,
        reasons,
        actorId: actor.id,
        actorEmail: actor.email,
        actorName: actor.name,
      });
      created += 1;
    }
  }

  return { created, updated, skipped, totalPairsEvaluated };
}

export async function getMatchDetail(id: string, actor?: PublicAdminUser, db?: Db) {
  const database = db || await getDb();
  const match = await getMatchRecord(database, id);
  if (!match) return null;

  const demandRecords = await listAllDemandRecords(database);
  const demandRecord = demandRecords.find((r) => demandKey(r.source, r.sourceId) === match.demandKey);
  const supplyRecord = await getSupplyRecord(database, match.supplyId);
  if (!demandRecord || !supplyRecord) return null;

  const demand = await buildDemandSummary(database, demandRecord);
  if (!demand) return null;

  const lead = await fetchUnifiedLeadBySourceId(demandRecord.source, demandRecord.sourceId, database);
  const { listMatchActivities } = await import('@/lib/ops/matching/activity-store');
  const activities = await listMatchActivities(database, id);
  const team = await listOpsTeamMembers(database);

  return {
    match,
    demand,
    demandLead: lead,
    supply: supplyRecord,
    supplySummary: buildSupplySummary(supplyRecord),
    activities: activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    team: team.map((m) => ({ id: m.id, name: m.name, email: m.email })),
    currentUserId: actor?.id,
  };
}

export { getDb as getDatabase };
