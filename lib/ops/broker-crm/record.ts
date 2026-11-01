import { brokerPriorityScore } from '@/lib/ops/broker-crm/priority';
import { inferTagsFromGroups } from '@/lib/ops/broker-crm/tags';
import type {
  BrokerCrmRequirement,
  BrokerCrmStatus,
  OpsBrokerCrmRecord,
} from '@/lib/ops/broker-crm/types';

export function buildBrokerCrmRecord(input: {
  id: string;
  phone: string;
  name: string;
  nameEdited?: boolean;
  groups: string[];
  admin: boolean;
  status?: BrokerCrmStatus;
  notes?: string;
  lastContactedAt?: string | null;
  areaTags?: string[];
  projectTags?: string[];
  requirements?: BrokerCrmRequirement[];
  doNotContactAt?: string | null;
  doNotContactReason?: string | null;
  createdAt: string;
  updatedAt: string;
  importedAt?: string | null;
}): OpsBrokerCrmRecord {
  const groups = input.groups;
  const inferred = inferTagsFromGroups(groups);
  const status = input.status || 'new';
  const doNotContact = status === 'do-not-contact';
  return {
    id: input.id,
    phone: input.phone,
    name: input.name.trim() || 'Unnamed broker',
    nameEdited: Boolean(input.nameEdited),
    groups,
    groupCount: groups.length,
    admin: Boolean(input.admin),
    derivedAreas: inferred.areas,
    derivedProjects: inferred.projects,
    areaTags: input.areaTags || [],
    projectTags: input.projectTags || [],
    status,
    notes: input.notes || '',
    lastContactedAt: input.lastContactedAt || null,
    requirements: input.requirements || [],
    priorityScore: brokerPriorityScore(groups.length, Boolean(input.admin)),
    doNotContact,
    doNotContactAt: doNotContact ? (input.doNotContactAt || input.updatedAt) : null,
    doNotContactReason: doNotContact ? (input.doNotContactReason || null) : null,
    source: 'whatsapp_groups',
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    importedAt: input.importedAt === undefined ? input.updatedAt : input.importedAt,
  };
}
