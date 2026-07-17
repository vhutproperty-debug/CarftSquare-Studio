/**
 * Phase 1 unified lead query — read-time normalization across source collections.
 *
 * Scalability note: merges bounded per-source fetches in memory before paginating.
 * Suitable for a 3-person internal team at current lead volume. Not designed for
 * high-volume portal ingestion without dedicated ops_leads storage (future phase).
 */
import type { Db } from 'mongodb';
// @ts-expect-error JS module without types
import { getDb } from '@/lib/mongodb';
import { resolveAdapters, getLeadAdapter } from '@/lib/ops/leads/adapters';
import { runAdapterSafely } from '@/lib/ops/leads/adapters/shared';
import { sortLeadsNewestFirst } from '@/lib/ops/leads/normalize';
import type {
  NormalizedOpsLead,
  OpsDashboardStats,
  OpsLeadCategory,
  OpsLeadSource,
  OpsLeadSourceHealth,
  OpsLeadsQueryResult,
} from '@/lib/ops/leads/types';
import { OPS_LEAD_SOURCES } from '@/lib/ops/leads/types';

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
export const MAX_PER_SOURCE_FETCH = 500;
export const MAX_COUNT_SCAN = 2000;

export type UnifiedLeadsQueryParams = {
  page?: number;
  pageSize?: number;
  source?: OpsLeadSource;
  category?: OpsLeadCategory;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  /** When true, skip per-adapter countLeads (Demand re-paginates after sidecar merge). */
  skipCounts?: boolean;
};

function clampPagination(page?: number, pageSize?: number) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE));
  return { page: safePage, pageSize: safePageSize };
}

function filterByCategory(leads: NormalizedOpsLead[], category?: OpsLeadCategory) {
  if (!category) return leads;
  return leads.filter((lead) => lead.category === category);
}

export async function queryUnifiedLeads(
  params: UnifiedLeadsQueryParams,
  db?: Db,
): Promise<OpsLeadsQueryResult> {
  const database = db || await getDb();
  const { page, pageSize } = clampPagination(params.page, params.pageSize);
  const perSourceLimit = Math.min(page * pageSize, MAX_PER_SOURCE_FETCH);
  const adapters = resolveAdapters(params.source);

  const sourceHealth: Partial<OpsLeadSourceHealth> = {};
  const countFilters = {
    search: params.search,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  };

  const [fetchResults, countResults] = await Promise.all([
    Promise.all(
      adapters.map(async (adapter) => {
        const result = await runAdapterSafely(
          adapter.source,
          () => adapter.fetchLeads(database, {
            limit: perSourceLimit,
            search: params.search,
            dateFrom: params.dateFrom,
            dateTo: params.dateTo,
          }),
          [] as NormalizedOpsLead[],
        );
        sourceHealth[adapter.source] = result.status;
        return result.value;
      }),
    ),
    params.skipCounts
      ? Promise.resolve([] as number[])
      : Promise.all(
        adapters.map(async (adapter) => {
          const result = await runAdapterSafely(
            adapter.source,
            () => adapter.countLeads(database, countFilters),
            0,
          );
          if (result.status === 'error') {
            sourceHealth[adapter.source] = 'error';
          } else if (!sourceHealth[adapter.source]) {
            sourceHealth[adapter.source] = 'ok';
          }
          return result.value;
        }),
      ),
  ]);

  const merged = filterByCategory(fetchResults.flat(), params.category);
  const sorted = sortLeadsNewestFirst(merged);
  const start = (page - 1) * pageSize;
  const items = sorted.slice(start, start + pageSize);

  const rawTotal = params.skipCounts
    ? sorted.length
    : countResults.reduce((sum, count) => sum + count, 0);
  const total = params.category && !params.skipCounts
    ? filterByCategory(
      sortLeadsNewestFirst(
        (await Promise.all(
          adapters.map(async (adapter) => {
            const result = await runAdapterSafely(
              adapter.source,
              () => adapter.fetchLeads(database, {
                limit: MAX_COUNT_SCAN,
                search: params.search,
                dateFrom: params.dateFrom,
                dateTo: params.dateTo,
              }),
              [] as NormalizedOpsLead[],
            );
            return result.value;
          }),
        )).flat(),
      ),
      params.category,
    ).length
    : rawTotal;

  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    sourceHealth,
  };
}

export async function fetchUnifiedLeadBySourceId(
  source: OpsLeadSource,
  id: string,
  db?: Db,
): Promise<NormalizedOpsLead | null> {
  const database = db || await getDb();
  const adapter = getLeadAdapter(source);
  const result = await runAdapterSafely(
    source,
    () => adapter.fetchLeadById(database, id),
    null,
  );
  return result.value;
}

function startOfTodayIso(): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

function sevenDaysAgoIso(): string {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

export async function queryOpsDashboardStats(db?: Db): Promise<OpsDashboardStats> {
  const database = db || await getDb();
  const sourceHealth: Partial<OpsLeadSourceHealth> = {};
  const sourceBreakdown = Object.fromEntries(
    OPS_LEAD_SOURCES.map((source) => [source, 0]),
  ) as Record<OpsLeadSource, number>;

  let totalLeads = 0;
  let leadsToday = 0;
  let leadsLast7Days = 0;
  const latestCandidates: NormalizedOpsLead[] = [];

  await Promise.all(
    OPS_LEAD_SOURCES.map(async (source) => {
      const adapter = getLeadAdapter(source);
      const [totalResult, todayResult, weekResult, latestResult] = await Promise.all([
        runAdapterSafely(source, () => adapter.countLeads(database, {}), 0),
        runAdapterSafely(source, () => adapter.countLeads(database, { dateFrom: startOfTodayIso() }), 0),
        runAdapterSafely(source, () => adapter.countLeads(database, { dateFrom: sevenDaysAgoIso() }), 0),
        runAdapterSafely(source, () => adapter.fetchLeads(database, { limit: 5 }), [] as NormalizedOpsLead[]),
      ]);

      const status = [totalResult, todayResult, weekResult, latestResult].some((r) => r.status === 'error')
        ? 'error'
        : 'ok';
      sourceHealth[source] = status;

      sourceBreakdown[source] = totalResult.value;
      totalLeads += totalResult.value;
      leadsToday += todayResult.value;
      leadsLast7Days += weekResult.value;
      latestCandidates.push(...latestResult.value);
    }),
  );

  return {
    totalLeads,
    leadsToday,
    leadsLast7Days,
    sourceBreakdown,
    latestLeads: sortLeadsNewestFirst(latestCandidates).slice(0, 8),
    sourceHealth,
  };
}
