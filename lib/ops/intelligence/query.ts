/**
 * Operations Intelligence — read-only aggregation across all ops collections.
 */
import type { Db } from 'mongodb';
// @ts-expect-error JS module without types
import { getDb } from '@/lib/mongodb';
import { listAllDemandRecords } from '@/lib/ops/demand/store';
import { listSupplyRecords } from '@/lib/ops/supply/store';
import { listMatchRecords } from '@/lib/ops/matching/store';
import { listDealRecords } from '@/lib/ops/deals/store';
import { listRevenueRecords } from '@/lib/ops/revenue/store';
import { computeRevenueMetrics } from '@/lib/ops/revenue/query';
import { listAgreementRecords } from '@/lib/ops/agreements/store';
import { computeAgreementMetrics } from '@/lib/ops/agreements/query';
import { listRenewalRecords } from '@/lib/ops/renewals/store';
import { computeRenewalMetrics } from '@/lib/ops/renewals/query';
import { isActiveDealStage } from '@/lib/ops/deals/statuses';

export type OpsIntelligenceOverview = {
  pipeline: {
    demandReady: number;
    supplyReady: number;
    activeMatches: number;
    activeDeals: number;
  };
  revenue: ReturnType<typeof computeRevenueMetrics>;
  agreements: ReturnType<typeof computeAgreementMetrics>;
  renewals: ReturnType<typeof computeRenewalMetrics>;
  brokerLeaderboard: Array<{
    brokerId: string;
    brokerName: string;
    deals: number;
    expectedRevenue: number;
    collectedRevenue: number;
    pendingRevenue: number;
  }>;
  alerts: Array<{ level: 'high' | 'medium' | 'low'; message: string }>;
};

export async function queryOpsIntelligence(db?: Db): Promise<OpsIntelligenceOverview> {
  const database = db || await getDb();

  const [demand, supply, matches, deals, revenue, agreements, renewals] = await Promise.all([
    listAllDemandRecords(database),
    listSupplyRecords(database),
    listMatchRecords(database),
    listDealRecords(database),
    listRevenueRecords(database),
    listAgreementRecords(database),
    listRenewalRecords(database),
  ]);

  const revenueMetrics = computeRevenueMetrics(revenue);
  const agreementMetrics = computeAgreementMetrics(agreements);
  const renewalMetrics = computeRenewalMetrics(renewals);

  const brokerMap = new Map<string, { brokerId: string; brokerName: string; deals: number; expectedRevenue: number; collectedRevenue: number; pendingRevenue: number }>();

  for (const deal of deals) {
    const key = deal.broker || 'unassigned';
    const row = brokerMap.get(key) || {
      brokerId: key,
      brokerName: deal.brokerName || 'Unassigned',
      deals: 0,
      expectedRevenue: 0,
      collectedRevenue: 0,
      pendingRevenue: 0,
    };
    row.deals += isActiveDealStage(deal.stage) ? 1 : 0;
    brokerMap.set(key, row);
  }

  for (const r of revenue) {
    const key = r.broker || 'unassigned';
    const row = brokerMap.get(key) || {
      brokerId: key,
      brokerName: r.brokerName || 'Unassigned',
      deals: 0,
      expectedRevenue: 0,
      collectedRevenue: 0,
      pendingRevenue: 0,
    };
    row.expectedRevenue += r.expectedAmount;
    row.collectedRevenue += r.collectedAmount;
    row.pendingRevenue += r.pendingAmount;
    brokerMap.set(key, row);
  }

  const alerts: OpsIntelligenceOverview['alerts'] = [];

  if (revenueMetrics.overdueCount > 0) {
    alerts.push({ level: 'high', message: `${revenueMetrics.overdueCount} brokerage payment(s) overdue` });
  }
  if (agreementMetrics.expiringSoon > 0) {
    alerts.push({ level: 'medium', message: `${agreementMetrics.expiringSoon} agreement(s) expiring within 30 days` });
  }
  if (renewalMetrics.dueNow > 0) {
    alerts.push({ level: 'high', message: `${renewalMetrics.dueNow} renewal(s) due now` });
  }
  if (demand.filter((d) => d.status === 'READY_FOR_MATCHING').length > 5) {
    alerts.push({ level: 'low', message: 'High demand ready for matching — run matching engine' });
  }

  return {
    pipeline: {
      demandReady: demand.filter((d) => d.status === 'READY_FOR_MATCHING').length,
      supplyReady: supply.filter((s) => s.readyForMatching && s.status === 'AVAILABLE').length,
      activeMatches: matches.filter((m) => !['REJECTED', 'CONVERTED_TO_DEAL'].includes(m.status)).length,
      activeDeals: deals.filter((d) => isActiveDealStage(d.stage)).length,
    },
    revenue: revenueMetrics,
    agreements: agreementMetrics,
    renewals: renewalMetrics,
    brokerLeaderboard: [...brokerMap.values()].sort((a, b) => b.collectedRevenue - a.collectedRevenue).slice(0, 10),
    alerts,
  };
}

export { getDb as getDatabase };
