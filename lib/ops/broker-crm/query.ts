import { isPriorityBroker } from '@/lib/ops/broker-crm/priority';
import { isDoNotContact } from '@/lib/ops/broker-crm/privacy';
import { brokerAreaLabels, brokerProjectLabels } from '@/lib/ops/broker-crm/tags';
import type {
  BrokerCrmListItem,
  BrokerCrmListQuery,
  BrokerCrmListResult,
  BrokerCrmMetrics,
  OpsBrokerCrmRecord,
} from '@/lib/ops/broker-crm/types';

export function toBrokerCrmListItem(record: OpsBrokerCrmRecord): BrokerCrmListItem {
  return {
    id: record.id,
    phone: record.phone,
    name: record.name,
    groups: record.groups,
    groupCount: record.groupCount,
    admin: record.admin,
    areas: brokerAreaLabels(record),
    projects: brokerProjectLabels(record),
    status: record.status,
    lastContactedAt: record.lastContactedAt,
    priorityScore: record.priorityScore,
    priority: isPriorityBroker(record.groupCount, record.admin),
    requirementCount: record.requirements.filter((item) => item.active).length,
    doNotContact: isDoNotContact(record),
  };
}

function haystack(record: OpsBrokerCrmRecord): string {
  return [
    record.name,
    record.phone,
    record.groups.join(' '),
    brokerAreaLabels(record).join(' '),
    brokerProjectLabels(record).join(' '),
    record.status,
  ].join(' ').toLowerCase();
}

function compare(a: OpsBrokerCrmRecord, b: OpsBrokerCrmRecord, query: BrokerCrmListQuery): number {
  const dir = query.sortDir === 'asc' ? 1 : -1;
  const sort = query.sort || 'priority';
  let diff = 0;
  if (sort === 'name') diff = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) * dir;
  else if (sort === 'groupCount') diff = (a.groupCount - b.groupCount) * dir;
  else if (sort === 'lastContacted') {
    if (!a.lastContactedAt && !b.lastContactedAt) diff = 0;
    else if (!a.lastContactedAt) return 1;
    else if (!b.lastContactedAt) return -1;
    else diff = a.lastContactedAt.localeCompare(b.lastContactedAt) * dir;
  } else diff = (a.priorityScore - b.priorityScore) * dir;
  if (diff === 0) diff = b.priorityScore - a.priorityScore;
  if (diff === 0) diff = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  if (diff === 0) return a.phone.localeCompare(b.phone);
  return diff;
}

function metricsFor(records: OpsBrokerCrmRecord[]): BrokerCrmMetrics {
  return {
    total: records.length,
    priority: records.filter((record) => isPriorityBroker(record.groupCount, record.admin)).length,
    admins: records.filter((record) => record.admin).length,
    multiGroup: records.filter((record) => record.groupCount > 1).length,
    doNotContact: records.filter((record) => isDoNotContact(record)).length,
    withRequirements: records.filter((record) => record.requirements.some((item) => item.active)).length,
  };
}

export function applyBrokerCrmQuery(
  records: OpsBrokerCrmRecord[],
  query: BrokerCrmListQuery = {},
): BrokerCrmListResult {
  const search = query.search?.trim().toLowerCase() || '';
  const group = query.group?.trim().toLowerCase() || '';
  const area = query.area?.trim().toLowerCase() || '';
  const filtered = records.filter((record) => {
    if (query.status && query.status !== 'all' && record.status !== query.status) return false;
    if (query.priorityOnly && !isPriorityBroker(record.groupCount, record.admin)) return false;
    if (group && !record.groups.some((item) => item.toLowerCase() === group)) return false;
    if (area && !brokerAreaLabels(record).some((item) => item.toLowerCase() === area)) return false;
    if (search && !haystack(record).includes(search)) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => compare(a, b, query));
  const pageSize = Math.min(100, Math.max(1, query.pageSize || 25));
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(totalPages, Math.max(1, query.page || 1));
  const start = (page - 1) * pageSize;
  const groups = new Set<string>();
  const areas = new Set<string>();
  for (const record of records) {
    for (const item of record.groups) groups.add(item);
    for (const item of brokerAreaLabels(record)) areas.add(item);
  }
  return {
    items: sorted.slice(start, start + pageSize).map(toBrokerCrmListItem),
    pagination: { page, pageSize, total, totalPages },
    filterOptions: {
      groups: [...groups].sort((a, b) => a.localeCompare(b)),
      areas: [...areas].sort((a, b) => a.localeCompare(b)),
    },
    metrics: metricsFor(records),
  };
}
