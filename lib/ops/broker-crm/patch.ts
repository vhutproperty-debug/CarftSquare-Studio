import { findBudgetBand } from '@/lib/ops/broker-crm/bands';
import { BrokerCrmValidationError } from '@/lib/ops/broker-crm/errors';
import { buildBrokerCrmRecord } from '@/lib/ops/broker-crm/record';
import { assertBrokerFacingText } from '@/lib/ops/broker-crm/privacy';
import { uniqueLabels } from '@/lib/ops/broker-crm/tags';
import type { BrokerCrmIntent, BrokerCrmRequirement, BrokerCrmStatus, OpsBrokerCrmRecord } from '@/lib/ops/broker-crm/types';
import { isBrokerCrmStatus } from '@/lib/ops/broker-crm/types';

export type BrokerCrmRequirementInput = {
  id?: string;
  bhk: string;
  budgetBandId: string;
  area: string;
  project?: string;
  intent: BrokerCrmIntent;
  active?: boolean;
};

export type BrokerCrmPatch = {
  name?: string;
  status?: BrokerCrmStatus;
  notes?: string;
  lastContactedAt?: string | null;
  areaTags?: string[];
  projectTags?: string[];
  requirements?: BrokerCrmRequirementInput[];
  doNotContactReason?: string | null;
};

function cleanTagList(values: string[], label: string): string[] {
  const tags = uniqueLabels(values).slice(0, 24).map((tag) => tag.slice(0, 80));
  for (const tag of tags) assertBrokerFacingText(tag, label);
  return tags;
}

function cleanRequirement(input: BrokerCrmRequirementInput, now: string): BrokerCrmRequirement {
  const intent = input.intent === 'buy' ? 'buy' : input.intent === 'rent' ? 'rent' : null;
  if (!intent) throw new BrokerCrmValidationError('Each requirement needs rent or buy.');
  const bhk = String(input.bhk || '').trim().slice(0, 20);
  if (!bhk) throw new BrokerCrmValidationError('Each requirement needs a BHK.');
  const band = findBudgetBand(String(input.budgetBandId || ''));
  if (!band || band.intent !== intent) {
    throw new BrokerCrmValidationError('Choose a budget band that matches rent or buy.');
  }
  const area = String(input.area || '').trim().slice(0, 80);
  const project = String(input.project || '').trim().slice(0, 80);
  if (!area && !project) throw new BrokerCrmValidationError('Each requirement needs an area or a project.');
  assertBrokerFacingText(bhk, 'BHK');
  assertBrokerFacingText(area, 'Area');
  if (project) assertBrokerFacingText(project, 'Project');
  const id = typeof input.id === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(input.id)
    ? input.id
    : globalThis.crypto.randomUUID();
  return {
    id,
    bhk,
    budgetBandId: band.id,
    area,
    project,
    intent,
    active: input.active !== false,
    updatedAt: now,
  };
}

function cleanDate(value: string | null): string | null {
  if (value == null || value === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BrokerCrmValidationError('Last contacted uses a calendar date.');
  }
  return value;
}

export function applyBrokerCrmPatch(
  record: OpsBrokerCrmRecord,
  patch: BrokerCrmPatch,
  now: string,
): OpsBrokerCrmRecord {
  if (patch.status && !isBrokerCrmStatus(patch.status)) {
    throw new BrokerCrmValidationError('Status must be new, contacted, active, dormant, or do-not-contact.');
  }
  const status = patch.status || record.status;
  let name = record.name;
  let nameEdited = record.nameEdited;
  if (patch.name !== undefined) {
    const nextName = patch.name.trim().slice(0, 120);
    if (nextName && nextName !== record.name) nameEdited = true;
    name = nextName || record.name;
  }
  const notes = patch.notes !== undefined ? patch.notes.slice(0, 4000) : record.notes;
  const lastContactedAt = patch.lastContactedAt !== undefined
    ? cleanDate(patch.lastContactedAt)
    : record.lastContactedAt;
  const areaTags = patch.areaTags ? cleanTagList(patch.areaTags, 'Area tag') : record.areaTags;
  const projectTags = patch.projectTags ? cleanTagList(patch.projectTags, 'Project tag') : record.projectTags;
  const requirements = patch.requirements
    ? patch.requirements.slice(0, 20).map((item) => cleanRequirement(item, now))
    : record.requirements;
  const reason = patch.doNotContactReason !== undefined
    ? (patch.doNotContactReason?.trim().slice(0, 200) || null)
    : record.doNotContactReason;

  return buildBrokerCrmRecord({
    id: record.id,
    phone: record.phone,
    name,
    nameEdited,
    groups: record.groups,
    admin: record.admin,
    status,
    notes,
    lastContactedAt,
    areaTags,
    projectTags,
    requirements,
    doNotContactAt: status === 'do-not-contact' ? (record.doNotContactAt || now) : null,
    doNotContactReason: status === 'do-not-contact' ? reason : null,
    createdAt: record.createdAt,
    updatedAt: now,
    importedAt: record.importedAt,
  });
}
