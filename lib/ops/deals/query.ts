/**
 * Deal workspace — reads matches/demand/supply (read-only), writes ops_deals only.
 * Optional: sync match status to CONVERTED_TO_DEAL on deal creation.
 */
import type { Db } from 'mongodb';
// @ts-expect-error JS module without types
import { getDb } from '@/lib/mongodb';
import { batchLatestDealActivities } from '@/lib/ops/deals/activity-store';
import { DEAL_ACTIVITY_LABELS } from '@/lib/ops/deals/statuses';
import type {
  DealQueueItem,
  DealWorkspaceMetrics,
  DealWorkspaceResult,
  OpsDealRecord,
} from '@/lib/ops/deals/types';
import { assigneeInitials, dealDisplayLabel, defaultDocumentsChecklist, parseBrokerageAmount } from '@/lib/ops/deals/types';
import type { DealStage } from '@/lib/ops/deals/statuses';
import { isActiveDealStage, STAGE_PROBABILITY } from '@/lib/ops/deals/statuses';
import {
  createDealRecord,
  getDealByMatchId,
  getDealRecord,
  listDealRecords,
} from '@/lib/ops/deals/store';
import { getMatchDetail } from '@/lib/ops/matching/query';
import { getMatchRecord, updateMatchRecord } from '@/lib/ops/matching/store';
import { createMatchActivity } from '@/lib/ops/matching/activity-store';
import { listOpsTeamMembers } from '@/lib/ops/calls/query';
import type { PublicAdminUser } from '@/lib/auth/rbac/types';
import type { DealTransactionType } from '@/lib/ops/deals/statuses';

export type DealWorkspaceQueryParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  project?: string;
  broker?: string;
  stage?: DealStage;
  transactionType?: DealTransactionType;
  minProbability?: number;
  paymentStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  mineOnly?: boolean;
  activeOnly?: boolean;
};

function matchesSearch(deal: OpsDealRecord, search: string): boolean {
  const q = search.toLowerCase();
  const haystack = [
    deal.dealNumber,
    deal.clientName,
    deal.ownerName,
    deal.project,
    deal.building,
    deal.flat,
    deal.internalNotes,
  ].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(q);
}

function filterDeals(deals: OpsDealRecord[], params: DealWorkspaceQueryParams, userId?: string): OpsDealRecord[] {
  return deals.filter((deal) => {
    if (params.search && !matchesSearch(deal, params.search)) return false;
    if (params.project && !(deal.project || '').toLowerCase().includes(params.project.toLowerCase())) return false;
    if (params.broker && deal.broker !== params.broker) return false;
    if (params.stage && deal.stage !== params.stage) return false;
    if (params.transactionType && deal.transactionType !== params.transactionType) return false;
    if (params.minProbability != null && deal.probability < params.minProbability) return false;
    if (params.paymentStatus && deal.paymentStatus !== params.paymentStatus) return false;
    if (params.mineOnly && userId && deal.broker !== userId) return false;
    if (params.activeOnly && !isActiveDealStage(deal.stage)) return false;
    if (params.dateFrom && deal.createdAt < new Date(params.dateFrom).toISOString()) return false;
    if (params.dateTo && deal.createdAt > new Date(params.dateTo).toISOString()) return false;
    return true;
  });
}

export function computeDealMetrics(deals: OpsDealRecord[]): DealWorkspaceMetrics {
  const active = deals.filter((d) => isActiveDealStage(d.stage));
  return {
    activeDeals: active.length,
    siteVisits: deals.filter((d) => d.stage === 'SITE_VISIT_SCHEDULED' || d.stage === 'SITE_VISIT_COMPLETED').length,
    negotiations: deals.filter((d) => d.stage === 'NEGOTIATION' || d.stage === 'TOKEN_PENDING').length,
    agreementPending: deals.filter((d) =>
      d.stage === 'AGREEMENT_SCHEDULED' || d.stage === 'DOCUMENTATION',
    ).length,
    commissionPending: deals.filter((d) => d.stage === 'COMMISSION_PENDING').length,
    closedDeals: deals.filter((d) => d.stage === 'CLOSED' || d.stage === 'COMMISSION_RECEIVED').length,
    lostDeals: deals.filter((d) => d.stage === 'LOST').length,
    expectedRevenue: active.reduce((sum, d) => sum + parseBrokerageAmount(d.expectedBrokerage || d.actualBrokerage), 0),
    collectedRevenue: deals.reduce((sum, d) => sum + parseBrokerageAmount(d.commissionCollected || d.actualBrokerage), 0),
  };
}

export async function enrichDealItems(db: Db, deals: OpsDealRecord[]): Promise<DealQueueItem[]> {
  const activityMap = await batchLatestDealActivities(db, deals.map((d) => d.id));
  return deals.map((deal) => {
    const latest = activityMap.get(deal.id);
    return {
      id: deal.id,
      deal,
      lastActivityLabel: latest ? `${DEAL_ACTIVITY_LABELS[latest.type]} — ${latest.message}` : null,
      assigneeInitials: assigneeInitials(deal.brokerName),
    };
  });
}

export async function queryDealWorkspace(
  params: DealWorkspaceQueryParams,
  actor?: PublicAdminUser,
  db?: Db,
): Promise<DealWorkspaceResult> {
  const database = db || await getDb();
  const page = params.page || 1;
  const pageSize = params.pageSize || 25;

  const allDeals = await listDealRecords(database);
  const filtered = filterDeals(allDeals, params, actor?.id);
  filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageDeals = filtered.slice((page - 1) * pageSize, page * pageSize);
  const items = await enrichDealItems(database, pageDeals);

  return {
    items,
    pagination: { page, pageSize, total, totalPages },
    metrics: computeDealMetrics(allDeals),
  };
}

export async function createDealFromMatch(
  matchId: string,
  actor: PublicAdminUser,
  db?: Db,
): Promise<{ deal: OpsDealRecord; alreadyExists?: boolean }> {
  const database = db || await getDb();

  const existing = await getDealByMatchId(database, matchId);
  if (existing) {
    return { deal: existing, alreadyExists: true };
  }

  const match = await getMatchRecord(database, matchId);
  if (!match) {
    throw new Error('Match not found.');
  }
  if (match.status !== 'ACCEPTED' && match.status !== 'CONVERTED_TO_DEAL') {
    throw new Error('Deal can only be created from an accepted match.');
  }

  const detail = await getMatchDetail(matchId, actor, database);
  if (!detail) {
    throw new Error('Unable to load match details.');
  }

  const listingType = detail.supply.listingType;
  const transactionType: DealTransactionType | undefined = listingType === 'rent'
    ? 'rent'
    : listingType === 'sale'
      ? 'sale'
      : detail.demand.qualification.rentBuy === 'rent'
        ? 'rent'
        : detail.demand.qualification.rentBuy === 'buy'
          ? 'sale'
          : undefined;

  const expectedBrokerage = detail.supply.brokeragePercent && detail.supply.expectedRent
    ? detail.supply.expectedRent
    : detail.supply.expectedSalePrice
      ? detail.supply.expectedSalePrice
      : undefined;

  const deal = await createDealRecord(database, {
    matchId,
    demandKey: match.demandKey,
    demandSource: match.demandSource,
    demandSourceId: match.demandSourceId,
    supplyId: match.supplyId,
    broker: match.broker || actor.id,
    brokerName: match.brokerName || actor.name,
    clientName: detail.demand.name || undefined,
    ownerName: detail.supply.ownerName,
    project: detail.supply.project || detail.demand.projectName || undefined,
    building: detail.supply.building || undefined,
    flat: detail.supply.flatNumber || detail.supply.configuration || undefined,
    transactionType,
    expectedRent: detail.supply.expectedRent,
    expectedSaleValue: detail.supply.expectedSalePrice,
    expectedBrokerage: detail.supply.brokeragePercent
      ? `${detail.supply.brokeragePercent}%`
      : expectedBrokerage,
    interiorOpportunity: false,
    stage: match.siteVisitAt ? 'SITE_VISIT_SCHEDULED' : 'NEW',
    probability: STAGE_PROBABILITY[match.siteVisitAt ? 'SITE_VISIT_SCHEDULED' : 'NEW'],
    siteVisitDate: match.siteVisitAt || undefined,
    documentsChecklist: defaultDocumentsChecklist(),
    internalNotes: match.notes,
    createdBy: actor.id,
    createdByName: actor.name,
    paymentStatus: 'NOT_DUE',
    actorEmail: actor.email,
    actorName: actor.name,
  });

  if (match.status !== 'CONVERTED_TO_DEAL') {
    await updateMatchRecord(database, matchId, {
      status: 'CONVERTED_TO_DEAL',
      updatedBy: actor.id,
    });
    await createMatchActivity(database, {
      matchId,
      type: 'CONVERTED_TO_DEAL',
      message: `Converted to deal ${deal.dealNumber}`,
      meta: { dealId: deal.id, dealNumber: deal.dealNumber },
      actorId: actor.id,
      actorEmail: actor.email,
      actorName: actor.name,
    });
  }

  return { deal };
}

export async function getDealDetail(id: string, actor?: PublicAdminUser, db?: Db) {
  const database = db || await getDb();
  const deal = await getDealRecord(database, id);
  if (!deal) return null;

  const matchDetail = await getMatchDetail(deal.matchId, actor, database);
  const { listDealActivities } = await import('@/lib/ops/deals/activity-store');
  const activities = await listDealActivities(database, id);
  const team = await listOpsTeamMembers(database);

  return {
    deal,
    match: matchDetail?.match || null,
    demand: matchDetail?.demand || null,
    demandLead: matchDetail?.demandLead || null,
    supply: matchDetail?.supply || null,
    activities: activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    team: team.map((m) => ({ id: m.id, name: m.name, email: m.email })),
    currentUserId: actor?.id,
    displayLabel: dealDisplayLabel(deal),
  };
}

export { getDb as getDatabase };
