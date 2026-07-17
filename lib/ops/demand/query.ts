/**
 * Demand workspace query — merges read-only lead adapters with ops_demand_records sidecar.
 */
import type { Db } from 'mongodb';
// @ts-expect-error JS module without types
import { getDb } from '@/lib/mongodb';
import { DEMAND_CHANNELS } from '@/lib/ops/business';
import { getLatestDemandActivity } from '@/lib/ops/demand/activity-store';
import { mergeQualification } from '@/lib/ops/demand/qualification';
import type {
  DemandDuplicateHint,
  DemandQueueItem,
  DemandSourceBreakdownItem,
  DemandWorkspaceMetrics,
  DemandWorkspaceResult,
  OpsDemandRecord,
} from '@/lib/ops/demand/types';
import { demandKey } from '@/lib/ops/demand/types';
import type { DemandPriority, DemandStatus } from '@/lib/ops/demand/statuses';
import {
  batchGetDemandRecords,
  ensureDemandRecord,
  findDuplicatesByContact,
  listAllDemandRecords,
} from '@/lib/ops/demand/store';
import { queryUnifiedLeads, type UnifiedLeadsQueryParams } from '@/lib/ops/leads/query';
import type { NormalizedOpsLead, OpsLeadCategory, OpsLeadSource } from '@/lib/ops/leads/types';
import { OPS_LEAD_SOURCE_LABELS } from '@/lib/ops/leads/types';
import { listOpsTeamMembers } from '@/lib/ops/calls/query';
import type { PublicAdminUser } from '@/lib/auth/rbac/types';
import { normalizeIndianMobile } from '@/lib/phone/indian-mobile';

const SOURCE_TO_CHANNEL: Record<OpsLeadSource, string> = {
  homepage: 'craftsquare_website',
  painting: 'craftsquare_website',
  auris_serenity: 'craftsquare_website',
  satellite_elegance: 'craftsquare_website',
  designer_callback: 'craftsquare_website',
  quotation: 'craftsquare_website',
  housing_com: 'housing_com',
  housing: 'housing_com',
};

export type DemandWorkspaceQueryParams = UnifiedLeadsQueryParams & {
  status?: DemandStatus;
  priority?: DemandPriority;
  assignedTo?: string;
  mineOnly?: boolean;
  rentBuy?: 'rent' | 'buy';
  project?: string;
  building?: string;
  followUpToday?: boolean;
  overdueOnly?: boolean;
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function computeAgeHours(createdAt: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60)));
}

function priorityRank(priority: DemandPriority): number {
  if (priority === 'HIGH') return 0;
  if (priority === 'MEDIUM') return 1;
  return 2;
}

function isOverdueHigh(record: OpsDemandRecord): boolean {
  if (record.priority !== 'HIGH' || !record.nextFollowUpAt) return false;
  return new Date(record.nextFollowUpAt) < startOfToday();
}

function matchesRentBuy(lead: NormalizedOpsLead, record: OpsDemandRecord, rentBuy?: 'rent' | 'buy'): boolean {
  if (!rentBuy) return true;
  const q = record.qualification?.rentBuy;
  if (q && q !== 'unknown') return q === rentBuy;
  const intent = (lead.intent || lead.requirement || '').toLowerCase();
  if (rentBuy === 'rent') return intent.includes('rent') || intent.includes('lease');
  if (rentBuy === 'buy') return intent.includes('buy') || intent.includes('sale') || intent.includes('purchase');
  return true;
}

async function buildDuplicateHints(
  db: Db,
  lead: NormalizedOpsLead,
  allRecords: OpsDemandRecord[],
): Promise<DemandDuplicateHint[]> {
  const hints: DemandDuplicateHint[] = [];
  const normalizedPhone = normalizeIndianMobile(lead.phone);
  const email = lead.email?.trim().toLowerCase();

  for (const other of allRecords) {
    if (other.source === lead.source && other.sourceId === lead.sourceId) continue;
    if (normalizedPhone && other.normalizedPhone && other.normalizedPhone === normalizedPhone) {
      hints.push({
        source: other.source,
        sourceId: other.sourceId,
        matchType: 'phone',
        phone: other.normalizedPhone,
      });
      continue;
    }
    if (email && other.normalizedEmail && other.normalizedEmail === email) {
      hints.push({
        source: other.source,
        sourceId: other.sourceId,
        matchType: 'email',
        email: other.normalizedEmail,
      });
    }
  }

  if (!hints.length) {
    const dbDupes = await findDuplicatesByContact(db, lead.phone, lead.email, {
      source: lead.source,
      sourceId: lead.sourceId,
    });
    for (const d of dbDupes) {
      hints.push({
        source: d.source,
        sourceId: d.sourceId,
        matchType: d.normalizedPhone ? 'phone' : 'email',
        phone: d.normalizedPhone,
        email: d.normalizedEmail,
      });
    }
  }

  return hints.slice(0, 5);
}

function initials(name?: string | null, email?: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
  }
  return (email?.[0] || '?').toUpperCase();
}

export async function queryDemandWorkspace(
  params: DemandWorkspaceQueryParams,
  admin: PublicAdminUser,
  db?: Db,
): Promise<DemandWorkspaceResult> {
  const database = db || await getDb();
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 25));

  const leadResult = await queryUnifiedLeads({
    ...params,
    page: 1,
    pageSize: 500,
  }, database);

  const team = await listOpsTeamMembers(database);
  const teamMap = new Map(team.map((m) => [m.id, m]));

  const ensured: OpsDemandRecord[] = [];
  for (const lead of leadResult.items) {
    const record = await ensureDemandRecord(database, lead, admin.id);
    if (record.assignedTo && !record.assignedToName) {
      const member = teamMap.get(record.assignedTo);
      if (member) {
        record.assignedToName = member.name;
      }
    }
    ensured.push(record);
  }

  const allRecords = await listAllDemandRecords(database, 8000);
  const recordByKey = new Map(allRecords.map((r) => [demandKey(r.source, r.sourceId), r]));

  const mergedLeads = leadResult.items;
  const queueCandidates: DemandQueueItem[] = [];

  for (const lead of mergedLeads) {
    const key = demandKey(lead.source, lead.sourceId);
    const demand = recordByKey.get(key) || ensured.find((r) => r.source === lead.source && r.sourceId === lead.sourceId);
    if (!demand) continue;

    const latest = await getLatestDemandActivity(database, lead.source, lead.sourceId);
    const duplicateHints = await buildDuplicateHints(database, lead, allRecords);

    queueCandidates.push({
      key,
      lead,
      demand,
      lastActivityAt: latest?.createdAt || demand.updatedAt,
      lastActivityLabel: latest?.message || null,
      ageHours: computeAgeHours(lead.createdAt),
      duplicateHints,
      assigneeInitials: demand.assignedToName
        ? initials(demand.assignedToName)
        : demand.assignedTo
          ? initials(undefined, teamMap.get(demand.assignedTo)?.email)
          : undefined,
    });
  }

  let filtered = queueCandidates;

  if (params.status) {
    filtered = filtered.filter((item) => item.demand.status === params.status);
  }
  if (params.priority) {
    filtered = filtered.filter((item) => item.demand.priority === params.priority);
  }
  if (params.assignedTo) {
    filtered = filtered.filter((item) => item.demand.assignedTo === params.assignedTo);
  }
  if (params.mineOnly) {
    filtered = filtered.filter((item) => item.demand.assignedTo === admin.id || !item.demand.assignedTo);
  }
  if (params.rentBuy) {
    filtered = filtered.filter((item) => matchesRentBuy(item.lead, item.demand, params.rentBuy));
  }
  if (params.project?.trim()) {
    const q = params.project.trim().toLowerCase();
    filtered = filtered.filter((item) => item.lead.projectName?.toLowerCase().includes(q));
  }
  if (params.building?.trim()) {
    const q = params.building.trim().toLowerCase();
    filtered = filtered.filter((item) =>
      item.demand.qualification.preferredBuildings?.toLowerCase().includes(q)
      || item.lead.location?.toLowerCase().includes(q),
    );
  }
  if (params.followUpToday) {
    const start = startOfToday().toISOString();
    const end = endOfToday().toISOString();
    filtered = filtered.filter((item) =>
      item.demand.nextFollowUpAt
      && item.demand.nextFollowUpAt >= start
      && item.demand.nextFollowUpAt <= end,
    );
  }
  if (params.overdueOnly) {
    filtered = filtered.filter((item) =>
      item.demand.nextFollowUpAt && new Date(item.demand.nextFollowUpAt) < startOfToday(),
    );
  }

  filtered.sort((a, b) => {
    const overdueA = isOverdueHigh(a.demand) ? 0 : 1;
    const overdueB = isOverdueHigh(b.demand) ? 0 : 1;
    if (overdueA !== overdueB) return overdueA - overdueB;
    const pr = priorityRank(a.demand.priority) - priorityRank(b.demand.priority);
    if (pr !== 0) return pr;
    return new Date(b.lead.createdAt).getTime() - new Date(a.lead.createdAt).getTime();
  });

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  const metrics = computeMetrics(allRecords, mergedLeads);
  const sourceBreakdown = buildSourceBreakdown(mergedLeads);

  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    sourceHealth: leadResult.sourceHealth,
    metrics,
    sourceBreakdown,
  };
}

function computeMetrics(records: OpsDemandRecord[], leads: NormalizedOpsLead[]): DemandWorkspaceMetrics {
  const todayStart = startOfToday().toISOString();
  const leadKeys = new Set(leads.map((l) => demandKey(l.source, l.sourceId)));
  const visible = records.filter((r) => leadKeys.has(demandKey(r.source, r.sourceId)));

  const newToday = leads.filter((l) => l.createdAt >= todayStart).length;
  const qualified = visible.filter((r) => r.status === 'QUALIFIED').length;
  const waitingFollowUp = visible.filter((r) => r.status === 'FOLLOW_UP').length;
  const readyForMatching = visible.filter((r) => r.status === 'READY_FOR_MATCHING').length;
  const lost = visible.filter((r) => r.status === 'LOST').length;
  const overdueHighPriority = visible.filter(isOverdueHigh).length;

  const responseSamples = visible
    .filter((r) => r.firstContactedAt)
    .map((r) => {
      const lead = leads.find((l) => l.source === r.source && l.sourceId === r.sourceId);
      if (!lead) return null;
      return (new Date(r.firstContactedAt!).getTime() - new Date(lead.createdAt).getTime()) / 60000;
    })
    .filter((v): v is number => v != null && v >= 0);

  const averageResponseMinutes = responseSamples.length
    ? Math.round(responseSamples.reduce((a, b) => a + b, 0) / responseSamples.length)
    : null;

  return {
    totalEnquiries: leads.length,
    newToday,
    qualified,
    waitingFollowUp,
    readyForMatching,
    lost,
    averageResponseMinutes,
    overdueHighPriority,
  };
}

function buildSourceBreakdown(leads: NormalizedOpsLead[]): DemandSourceBreakdownItem[] {
  const channelCounts = new Map<string, number>();
  for (const lead of leads) {
    const channelId = SOURCE_TO_CHANNEL[lead.source] || 'craftsquare_website';
    channelCounts.set(channelId, (channelCounts.get(channelId) || 0) + 1);
  }

  return DEMAND_CHANNELS.map((channel) => ({
    channelId: channel.id,
    label: channel.label,
    count: channelCounts.get(channel.id) || 0,
    live: channel.live,
  }));
}

export async function getDemandDetail(
  source: OpsLeadSource,
  sourceId: string,
  admin: PublicAdminUser,
  db?: Db,
) {
  const database = db || await getDb();
  const { fetchUnifiedLeadBySourceId } = await import('@/lib/ops/leads/query');
  const lead = await fetchUnifiedLeadBySourceId(source, sourceId, database);
  if (!lead) return null;

  const demand = await ensureDemandRecord(database, lead, admin.id);
  const { listDemandActivities } = await import('@/lib/ops/demand/activity-store');
  const activities = await listDemandActivities(database, source, sourceId);
  const duplicateHints = await buildDuplicateHints(database, lead, await listAllDemandRecords(database));
  const team = await listOpsTeamMembers(database);

  return { lead, demand, activities, duplicateHints, team };
}

export { mergeQualification };
