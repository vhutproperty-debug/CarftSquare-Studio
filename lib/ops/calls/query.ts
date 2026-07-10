import type { Db } from 'mongodb';
import { isSuperAdmin } from '@/lib/auth/rbac/roles';
import type { PublicAdminUser } from '@/lib/auth/rbac/types';
import { findAdminById, getDatabase as getAdminDb, migrateLegacyAdmins } from '@/lib/auth/rbac/store';
import {
  batchGetLatestActivities,
  buildTargetKey,
  countActivitiesLoggedToday,
  getCallTargetSummary,
  getDatabase as getCallDb,
  listCallActivitiesForTarget,
} from '@/lib/ops/calls/activity-store';
import { listProspects } from '@/lib/ops/calls/prospect-store';
import type {
  CallDisplayStatus,
} from '@/lib/ops/calls/statuses';
import type {
  CallQueueItem,
  CallQueueSection,
  CallTargetSummary,
  CallWorkspaceMetrics,
  OpsCallActivity,
  OpsProspect,
} from '@/lib/ops/calls/types';
import { LEAD_SOURCE_ADAPTERS } from '@/lib/ops/leads/adapters';
import { runAdapterSafely } from '@/lib/ops/leads/adapters/shared';
import { sortLeadsNewestFirst } from '@/lib/ops/leads/normalize';
import type { NormalizedOpsLead } from '@/lib/ops/leads/types';

const QUEUE_LEAD_LIMIT = 200;

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday(): Date {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

function isOverdueFollowUp(nextFollowUpAt?: string | null): boolean {
  if (!nextFollowUpAt) return false;
  return new Date(nextFollowUpAt).getTime() < startOfToday().getTime();
}

function isFollowUpDueToday(nextFollowUpAt?: string | null): boolean {
  if (!nextFollowUpAt) return false;
  const followUp = new Date(nextFollowUpAt);
  return followUp >= startOfToday() && followUp <= endOfToday();
}

function computeQueueRank(item: {
  callStatus: CallDisplayStatus;
  nextFollowUpAt?: string | null;
}): number {
  if (isOverdueFollowUp(item.nextFollowUpAt)) return 0;
  if (isFollowUpDueToday(item.nextFollowUpAt)) return 1;
  if (item.callStatus === 'INTERESTED') return 2;
  if (item.callStatus === 'NOT_CALLED') return 3;
  if (item.callStatus === 'CALL_BACK' || item.callStatus === 'FOLLOW_UP') return 4;
  return 5;
}

async function fetchRecentUnifiedLeads(db: Db): Promise<NormalizedOpsLead[]> {
  const results = await Promise.all(
    LEAD_SOURCE_ADAPTERS.map(async (adapter) => {
      const result = await runAdapterSafely(
        adapter.source,
        () => adapter.fetchLeads(db, { limit: QUEUE_LEAD_LIMIT }),
        [] as NormalizedOpsLead[],
      );
      return result.value;
    }),
  );
  return sortLeadsNewestFirst(results.flat()).slice(0, QUEUE_LEAD_LIMIT);
}

function leadToQueueItem(
  lead: NormalizedOpsLead,
  latest?: OpsCallActivity | null,
  adminNames?: Map<string, string>,
): CallQueueItem {
  const callStatus = (latest?.status as CallDisplayStatus) || 'NOT_CALLED';
  const wrongNumber = latest?.status === 'WRONG_NUMBER';
  return {
    id: `${lead.source}:${lead.sourceId}`,
    kind: 'unified_lead',
    name: lead.name,
    phone: lead.phone,
    projectName: lead.projectName,
    building: null,
    prospectType: null,
    leadSource: lead.source,
    assignedTo: null,
    assignedToName: null,
    callStatus,
    lastCalledAt: latest?.createdAt || null,
    nextFollowUpAt: latest?.nextFollowUpAt || null,
    doNotCall: callStatus === 'DO_NOT_CALL',
    wrongNumber,
    href: `/ops/leads/${lead.source}/${lead.sourceId}`,
    queueRank: computeQueueRank({ callStatus, nextFollowUpAt: latest?.nextFollowUpAt }),
  };
}

function prospectToQueueItem(
  prospect: OpsProspect,
  adminNames?: Map<string, string>,
): CallQueueItem {
  return {
    id: prospect.id,
    kind: 'ops_prospect',
    name: prospect.name,
    phone: prospect.phone,
    projectName: prospect.projectName,
    building: prospect.building,
    prospectType: prospect.prospectType,
    leadSource: null,
    assignedTo: prospect.assignedTo || null,
    assignedToName: prospect.assignedTo ? adminNames?.get(prospect.assignedTo) || null : null,
    callStatus: prospect.callStatus,
    lastCalledAt: prospect.updatedAt !== prospect.createdAt ? prospect.updatedAt : null,
    nextFollowUpAt: prospect.nextFollowUpAt || null,
    doNotCall: prospect.callStatus === 'DO_NOT_CALL',
    wrongNumber: Boolean(prospect.phoneInvalid) || prospect.callStatus === 'WRONG_NUMBER',
    href: `/ops/calls/${prospect.id}`,
    queueRank: computeQueueRank({
      callStatus: prospect.callStatus,
      nextFollowUpAt: prospect.nextFollowUpAt,
    }),
  };
}

export async function buildAdminNameMap(db: Db, ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(ids.filter(Boolean))];
  await migrateLegacyAdmins(db);
  await Promise.all(
    unique.map(async (id) => {
      const admin = await findAdminById(db, id);
      if (admin) map.set(id, admin.name || admin.email);
    }),
  );
  return map;
}

export function canViewAllCallRecords(admin: PublicAdminUser): boolean {
  return isSuperAdmin(admin);
}

export async function buildCallQueueItems(
  db: Db,
  admin: PublicAdminUser,
  filters: {
    assignedTo?: string;
    project?: string;
    prospectType?: OpsProspect['prospectType'];
    callStatus?: CallDisplayStatus;
    search?: string;
    mineOnly?: boolean;
  } = {},
): Promise<CallQueueItem[]> {
  const viewAll = canViewAllCallRecords(admin);

  const [leads, prospects] = await Promise.all([
    fetchRecentUnifiedLeads(db),
    listProspects(db, {
      assignedTo: filters.assignedTo,
      mineOnly: filters.mineOnly,
      currentAdminId: admin.id,
      isAdminViewAll: viewAll,
      project: filters.project,
      prospectType: filters.prospectType,
      callStatus: filters.callStatus,
      search: filters.search,
      limit: 1000,
    }),
  ]);

  const latestMap = await batchGetLatestActivities(
    db,
    [
      ...leads.map((lead) => ({
        targetType: 'unified_lead' as const,
        targetSource: lead.source,
        targetId: lead.sourceId,
      })),
      ...prospects.map((prospect) => ({
        targetType: 'ops_prospect' as const,
        targetId: prospect.id,
      })),
    ],
  );

  const adminIds = prospects.map((p) => p.assignedTo).filter(Boolean) as string[];
  latestMap.forEach((activity) => adminIds.push(activity.calledBy));
  const adminNames = await buildAdminNameMap(db, adminIds);

  let items: CallQueueItem[] = [
    ...leads.map((lead) => leadToQueueItem(
      lead,
      latestMap.get(buildTargetKey('unified_lead', lead.sourceId, lead.source)),
      adminNames,
    )),
    ...prospects.map((prospect) => {
      const latest = latestMap.get(buildTargetKey('ops_prospect', prospect.id));
      const item = prospectToQueueItem(prospect, adminNames);
      if (latest) {
        item.callStatus = latest.status as CallDisplayStatus;
        item.lastCalledAt = latest.createdAt;
        item.nextFollowUpAt = latest.nextFollowUpAt || item.nextFollowUpAt;
        item.doNotCall = latest.status === 'DO_NOT_CALL';
        item.wrongNumber = latest.status === 'WRONG_NUMBER' || item.wrongNumber;
        item.queueRank = computeQueueRank({
          callStatus: item.callStatus,
          nextFollowUpAt: item.nextFollowUpAt,
        });
      }
      return item;
    }),
  ];

  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    items = items.filter((item) => {
      const haystack = [item.name, item.phone, item.projectName, item.building]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  if (filters.callStatus) {
    items = items.filter((item) => item.callStatus === filters.callStatus);
  }

  if (filters.project?.trim()) {
    const project = filters.project.trim().toLowerCase();
    items = items.filter((item) => (
      item.projectName?.toLowerCase().includes(project)
      || item.building?.toLowerCase().includes(project)
    ));
  }

  if (filters.mineOnly) {
    items = items.filter((item) => (
      item.kind === 'unified_lead'
      || item.assignedTo === admin.id
    ));
  }

  return items.sort((a, b) => {
    if (a.queueRank !== b.queueRank) return a.queueRank - b.queueRank;
    const aFollow = a.nextFollowUpAt ? new Date(a.nextFollowUpAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bFollow = b.nextFollowUpAt ? new Date(b.nextFollowUpAt).getTime() : Number.MAX_SAFE_INTEGER;
    if (aFollow !== bFollow) return aFollow - bFollow;
    return (b.lastCalledAt || '').localeCompare(a.lastCalledAt || '');
  });
}

export function sectionizeCallQueue(items: CallQueueItem[], adminId: string): CallQueueSection[] {
  const todayStart = startOfToday().toISOString();
  const todayEnd = endOfToday().toISOString();

  const myToday = items.filter((item) => (
    item.assignedTo === adminId
    && item.nextFollowUpAt
    && item.nextFollowUpAt >= todayStart
    && item.nextFollowUpAt <= todayEnd
  ));

  const followUpsDue = items.filter((item) => isFollowUpDueToday(item.nextFollowUpAt));
  const overdue = items.filter((item) => isOverdueFollowUp(item.nextFollowUpAt));
  const notCalled = items.filter((item) => item.callStatus === 'NOT_CALLED');
  const interested = items.filter((item) => item.callStatus === 'INTERESTED');
  const recentlyCalled = items
    .filter((item) => item.lastCalledAt && item.callStatus !== 'NOT_CALLED')
    .slice(0, 20);

  return [
    { id: 'overdue', label: 'Overdue Follow-Ups', items: overdue.slice(0, 50) },
    { id: 'follow_ups_due', label: 'Follow-Ups Due Today', items: followUpsDue.slice(0, 50) },
    { id: 'my_today', label: 'My Calls Today', items: myToday.slice(0, 50) },
    { id: 'interested', label: 'Interested', items: interested.slice(0, 50) },
    { id: 'not_called', label: 'Not Called', items: notCalled.slice(0, 50) },
    { id: 'recently_called', label: 'Recently Called', items: recentlyCalled },
  ];
}

export async function getCallWorkspaceMetrics(
  db: Db,
  admin: PublicAdminUser,
): Promise<CallWorkspaceMetrics> {
  const items = await buildCallQueueItems(db, admin);
  const callsLoggedToday = await countActivitiesLoggedToday(
    db,
    canViewAllCallRecords(admin) ? undefined : admin.id,
  );

  return {
    callsDueToday: items.filter((item) => isFollowUpDueToday(item.nextFollowUpAt)).length,
    overdueFollowUps: items.filter((item) => isOverdueFollowUp(item.nextFollowUpAt)).length,
    notCalled: items.filter((item) => item.callStatus === 'NOT_CALLED').length,
    interested: items.filter((item) => item.callStatus === 'INTERESTED').length,
    callsLoggedToday,
  };
}

export async function getUnifiedLeadCallContext(
  source: string,
  id: string,
  db?: Db,
): Promise<{ summary: CallTargetSummary; activities: OpsCallActivity[] }> {
  const database = db || await getCallDb();
  const [summary, activities] = await Promise.all([
    getCallTargetSummary(database, 'unified_lead', id, source),
    listCallActivitiesForTarget(database, 'unified_lead', id, source, 100),
  ]);
  return { summary, activities };
}

export async function listOpsTeamMembers(db?: Db): Promise<Array<{ id: string; name: string; email: string }>> {
  const database = db || await getAdminDb();
  await migrateLegacyAdmins(database);
  const admins = await database
    .collection('admins')
    .find(
      { status: { $ne: 'suspended' } },
      { projection: { _id: 0, id: 1, name: 1, email: 1 } },
    )
    .sort({ name: 1 })
    .limit(50)
    .toArray();
  return admins as Array<{ id: string; name: string; email: string }>;
}
