/**
 * Supply workspace query — ops_supply_records is the source of truth (standalone inventory).
 */
import type { Db } from 'mongodb';
// @ts-expect-error JS module without types
import { getDb } from '@/lib/mongodb';
import { batchLatestActivities } from '@/lib/ops/supply/activity-store';
import { SUPPLY_ACTIVITY_LABELS } from '@/lib/ops/supply/statuses';
import type {
  OpsSupplyRecord,
  SupplyQueueItem,
  SupplyWorkspaceMetrics,
  SupplyWorkspaceResult,
} from '@/lib/ops/supply/types';
import { assigneeInitials } from '@/lib/ops/supply/types';
import type { SupplyListingType } from '@/lib/ops/supply/types';
import type { SupplyPriority, SupplyStatus } from '@/lib/ops/supply/statuses';
import { isAvailableStatus } from '@/lib/ops/supply/statuses';
import { listSupplyRecords } from '@/lib/ops/supply/store';
import { listOpsTeamMembers } from '@/lib/ops/calls/query';
import type { PublicAdminUser } from '@/lib/auth/rbac/types';

export type SupplyWorkspaceQueryParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: 'updatedAt' | 'createdAt' | 'project' | 'building' | 'agreementExpiry' | 'priority';
  sortDir?: 'asc' | 'desc';
  project?: string;
  building?: string;
  configuration?: string;
  listingType?: SupplyListingType;
  assignedBroker?: string;
  availabilityStatus?: string;
  exclusive?: boolean;
  keysAvailable?: boolean;
  agreementExpiring?: boolean;
  readyForMatching?: boolean;
  status?: SupplyStatus;
  priority?: SupplyPriority;
  mineOnly?: boolean;
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

function agreementExpiringWithinDays(value?: string, days = 30): boolean {
  if (!value) return false;
  const expiry = new Date(value);
  if (Number.isNaN(expiry.getTime())) return false;
  const limit = new Date();
  limit.setDate(limit.getDate() + days);
  return expiry >= startOfToday() && expiry <= limit;
}

function priorityRank(priority: SupplyPriority): number {
  if (priority === 'HIGH') return 0;
  if (priority === 'MEDIUM') return 1;
  return 2;
}

function matchesSearch(record: OpsSupplyRecord, search: string): boolean {
  const q = search.toLowerCase();
  const haystack = [
    record.project,
    record.building,
    record.wing,
    record.flatNumber,
    record.configuration,
    record.ownerName,
    record.ownerMobile,
    record.ownerEmail,
    record.availabilityStatus,
    record.internalNotes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

function filterRecords(records: OpsSupplyRecord[], params: SupplyWorkspaceQueryParams, userId?: string): OpsSupplyRecord[] {
  return records.filter((record) => {
    if (params.search && !matchesSearch(record, params.search)) return false;
    if (params.project && !(record.project || '').toLowerCase().includes(params.project.toLowerCase())) return false;
    if (params.building && !(record.building || '').toLowerCase().includes(params.building.toLowerCase())) return false;
    if (params.configuration && !(record.configuration || '').toLowerCase().includes(params.configuration.toLowerCase())) return false;
    if (params.listingType && record.listingType !== params.listingType) return false;
    if (params.assignedBroker && record.assignedBroker !== params.assignedBroker) return false;
    if (params.availabilityStatus && !(record.availabilityStatus || '').toLowerCase().includes(params.availabilityStatus.toLowerCase())) return false;
    if (params.exclusive === true && !record.exclusive) return false;
    if (params.keysAvailable === true && !record.keysAvailable) return false;
    if (params.readyForMatching === true && !record.readyForMatching) return false;
    if (params.status && record.status !== params.status) return false;
    if (params.priority && record.priority !== params.priority) return false;
    if (params.mineOnly && userId && record.assignedBroker !== userId) return false;
    if (params.agreementExpiring && !agreementExpiringWithinDays(record.agreementExpiry)) return false;

    if (params.followUpToday && record.nextFollowUpAt) {
      const followUp = new Date(record.nextFollowUpAt);
      if (followUp < startOfToday() || followUp > endOfToday()) return false;
    } else if (params.followUpToday) {
      return false;
    }

    if (params.overdueOnly) {
      if (!record.nextFollowUpAt || new Date(record.nextFollowUpAt) >= startOfToday()) return false;
    }

    return true;
  });
}

function sortRecords(
  records: OpsSupplyRecord[],
  sort: SupplyWorkspaceQueryParams['sort'] = 'updatedAt',
  sortDir: 'asc' | 'desc' = 'desc',
): OpsSupplyRecord[] {
  const dir = sortDir === 'asc' ? 1 : -1;
  return [...records].sort((a, b) => {
    if (sort === 'priority') {
      const diff = priorityRank(a.priority) - priorityRank(b.priority);
      return diff !== 0 ? diff * dir : (new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    const fieldA = sort === 'agreementExpiry' ? a.agreementExpiry || '' : (a[sort as keyof OpsSupplyRecord] as string) || '';
    const fieldB = sort === 'agreementExpiry' ? b.agreementExpiry || '' : (b[sort as keyof OpsSupplyRecord] as string) || '';
    if (fieldA < fieldB) return -1 * dir;
    if (fieldA > fieldB) return 1 * dir;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function computeSupplyMetrics(records: OpsSupplyRecord[]): SupplyWorkspaceMetrics {
  return {
    totalInventory: records.length,
    rentalInventory: records.filter((r) => r.listingType === 'rent').length,
    saleInventory: records.filter((r) => r.listingType === 'sale').length,
    availableNow: records.filter((r) => isAvailableStatus(r.status)).length,
    readyForMatching: records.filter((r) => r.readyForMatching).length,
    agreementExpiring: records.filter((r) => agreementExpiringWithinDays(r.agreementExpiry)).length,
    exclusiveListings: records.filter((r) => r.exclusive).length,
    withdrawn: records.filter((r) => r.status === 'WITHDRAWN').length,
  };
}

export async function querySupplyWorkspace(
  params: SupplyWorkspaceQueryParams,
  actor?: PublicAdminUser,
  db?: Db,
): Promise<SupplyWorkspaceResult> {
  const database = db || await getDb();
  const page = params.page || 1;
  const pageSize = params.pageSize || 25;

  const allRecords = await listSupplyRecords(database);
  const filtered = filterRecords(allRecords, params, actor?.id);
  const sorted = sortRecords(filtered, params.sort, params.sortDir);
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRecords = sorted.slice((page - 1) * pageSize, page * pageSize);

  const activityMap = await batchLatestActivities(database, pageRecords.map((r) => r.id));

  const items: SupplyQueueItem[] = pageRecords.map((record) => {
    const latest = activityMap.get(record.id);
    return {
      id: record.id,
      record,
      lastActivityAt: latest?.createdAt || record.updatedAt,
      lastActivityLabel: latest ? `${SUPPLY_ACTIVITY_LABELS[latest.type]} — ${latest.message}` : null,
      assigneeInitials: assigneeInitials(record.assignedBrokerName),
      agreementExpiringSoon: agreementExpiringWithinDays(record.agreementExpiry),
    };
  });

  return {
    items,
    pagination: { page, pageSize, total, totalPages },
    metrics: computeSupplyMetrics(allRecords),
  };
}

export async function getSupplyDetail(id: string, actor?: PublicAdminUser, db?: Db) {
  const database = db || await getDb();
  const { getSupplyRecord } = await import('@/lib/ops/supply/store');
  const { listSupplyActivities } = await import('@/lib/ops/supply/activity-store');

  const record = await getSupplyRecord(database, id);
  if (!record) return null;

  const [activities, team] = await Promise.all([
    listSupplyActivities(database, id),
    listOpsTeamMembers(database),
  ]);

  return {
    record,
    activities: activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    team: team.map((m) => ({ id: m.id, name: m.name, email: m.email })),
    currentUserId: actor?.id,
  };
}

export { getDb as getDatabase };
