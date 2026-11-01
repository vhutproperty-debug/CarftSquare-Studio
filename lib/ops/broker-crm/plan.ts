import { randomUUID } from 'node:crypto';
import { isPriorityBroker } from '@/lib/ops/broker-crm/priority';
import { canonicalPhone, parseAdminFlag, parseGroups } from '@/lib/ops/broker-crm/parse';
import { buildBrokerCrmRecord } from '@/lib/ops/broker-crm/record';
import type {
  BrokerCrmImportStats,
  BrokerImportRow,
  OpsBrokerCrmRecord,
} from '@/lib/ops/broker-crm/types';

export type CanonicalBrokerRow = {
  phone: string;
  name: string;
  groups: string[];
  admin: boolean;
};

export function canonicalizeImportRows(rows: BrokerImportRow[]): {
  merged: CanonicalBrokerRow[];
  skipped: number;
  dedupedInFile: number;
} {
  const byPhone = new Map<string, CanonicalBrokerRow>();
  let skipped = 0;
  let dedupedInFile = 0;
  for (const row of rows) {
    const phone = canonicalPhone(row.phoneRaw);
    if (!phone) {
      skipped += 1;
      continue;
    }
    const groups = parseGroups(row.groupsRaw);
    const admin = parseAdminFlag(row.adminRaw);
    const name = row.name.trim().slice(0, 120);
    const existing = byPhone.get(phone);
    if (!existing) {
      byPhone.set(phone, { phone, name, groups, admin });
      continue;
    }
    dedupedInFile += 1;
    const seen = new Set(existing.groups.map((group) => group.toLowerCase()));
    for (const group of groups) {
      if (seen.has(group.toLowerCase())) continue;
      seen.add(group.toLowerCase());
      existing.groups.push(group);
    }
    if (!existing.name && name) existing.name = name;
    if (admin) existing.admin = true;
  }
  return { merged: [...byPhone.values()], skipped, dedupedInFile };
}

function fingerprint(record: OpsBrokerCrmRecord): string {
  return JSON.stringify({
    name: record.name,
    nameEdited: record.nameEdited,
    groups: record.groups,
    groupCount: record.groupCount,
    admin: record.admin,
    derivedAreas: record.derivedAreas,
    derivedProjects: record.derivedProjects,
    areaTags: record.areaTags,
    projectTags: record.projectTags,
    status: record.status,
    notes: record.notes,
    lastContactedAt: record.lastContactedAt,
    requirements: record.requirements,
    priorityScore: record.priorityScore,
    doNotContact: record.doNotContact,
    doNotContactReason: record.doNotContactReason,
  });
}

function nextFromImport(existing: OpsBrokerCrmRecord | undefined, row: CanonicalBrokerRow, now: string): OpsBrokerCrmRecord {
  const groups = row.groups.length ? row.groups : (existing?.groups || []);
  const canRename = existing ? !existing.nameEdited : true;
  const incomingName = row.name.trim();
  const name = existing
    ? ((canRename && incomingName) || !existing.name || existing.name === 'Unnamed broker'
      ? (incomingName || existing.name)
      : existing.name)
    : (incomingName || 'Unnamed broker');
  return buildBrokerCrmRecord({
    id: existing?.id || randomUUID(),
    phone: row.phone,
    name,
    nameEdited: existing?.nameEdited || false,
    groups,
    admin: row.admin,
    status: existing?.status || 'new',
    notes: existing?.notes || '',
    lastContactedAt: existing?.lastContactedAt || null,
    areaTags: existing?.areaTags || [],
    projectTags: existing?.projectTags || [],
    requirements: existing?.requirements || [],
    doNotContactAt: existing?.doNotContactAt || null,
    doNotContactReason: existing?.doNotContactReason || null,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    importedAt: now,
  });
}

export function planBrokerCrmImport(
  existing: OpsBrokerCrmRecord[],
  rows: BrokerImportRow[],
  now: string,
): { writes: OpsBrokerCrmRecord[]; stats: BrokerCrmImportStats } {
  const canonical = canonicalizeImportRows(rows);
  const byPhone = new Map(existing.map((record) => [record.phone, record]));
  const writes: OpsBrokerCrmRecord[] = [];
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  for (const row of canonical.merged) {
    const previous = byPhone.get(row.phone);
    const next = nextFromImport(previous, row, now);
    if (previous && fingerprint(previous) === fingerprint(next)) {
      unchanged += 1;
      continue;
    }
    if (previous) updated += 1;
    else created += 1;
    writes.push(next);
  }
  const projected = new Map(byPhone);
  for (const write of writes) projected.set(write.phone, write);
  const all = [...projected.values()];
  return {
    writes,
    stats: {
      rows: rows.length,
      created,
      updated,
      unchanged,
      skipped: canonical.skipped,
      dedupedInFile: canonical.dedupedInFile,
      priority: all.filter((record) => isPriorityBroker(record.groupCount, record.admin)).length,
      admins: all.filter((record) => record.admin).length,
    },
  };
}
