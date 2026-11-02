import { normalizeContactPhone } from '@/lib/ops/contacts/phone';
import { CONTACT_ROLES, type Contact, type ContactRole, type InteractionChange, type UnitRelation } from '@/lib/ops/contacts/types';

export type ContactPatch = {
  name?: string;
  email?: string;
  phones?: string[];
  roles?: string[];
  do_not_call?: boolean;
  opted_out?: boolean;
  suspected_broker?: 'VERIFY' | null | '';
  complex?: string;
  unit?: {
    unitLinkId?: string;
    complex?: string;
    tower?: string;
    flat?: string;
    relation?: string;
    agreementStart?: string;
    agreementEnd?: string;
  };
};

export type UnitLinkView = {
  id: string;
  unitId: string;
  relation: UnitRelation;
  agreementStart: string;
  agreementEnd: string;
  complex: string;
  tower: string;
  flat: string;
};

export type WritePlan = {
  contact: Partial<Pick<Contact, 'name' | 'email' | 'phones' | 'roles' | 'do_not_call' | 'opted_out' | 'suspected_broker'>>;
  addComplexes: string[];
  addUnit?: {
    complex: string;
    tower: string;
    flat: string;
    relation: UnitRelation;
    agreementStart: string;
    agreementEnd: string;
  };
  updateLink?: {
    id: string;
    relation?: UnitRelation;
    agreementStart?: string;
    agreementEnd?: string;
  };
  changes: InteractionChange[];
};

function sameList(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const set = new Set(left);
  return right.every((item) => set.has(item));
}

function complexKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function planContactWrite(input: {
  full: boolean;
  contact: Contact;
  complexLinks: Array<{ complex: string; complexKey: string }>;
  unitLinks: UnitLinkView[];
  patch: ContactPatch;
}): { ok: true; plan: WritePlan } | { ok: false; error: string } {
  const plan: WritePlan = { contact: {}, addComplexes: [], changes: [] };
  const { full, contact, patch } = input;

  if (patch.name != null) {
    const next = patch.name.trim();
    const prev = contact.name.trim();
    if (next !== prev) {
      if (!full && prev) return { ok: false, error: 'Name is already set. Only a super admin can change it.' };
      if (!full && !next) return { ok: false, error: 'Name cannot be cleared.' };
      plan.contact.name = next;
      plan.changes.push({ field: 'name', from: prev, to: next });
    }
  }

  if (patch.email != null) {
    const next = patch.email.trim().toLowerCase();
    const prev = contact.email.trim().toLowerCase();
    if (next !== prev) {
      if (!full && prev) return { ok: false, error: 'Email is already set. Only a super admin can change it.' };
      if (!full && !next) return { ok: false, error: 'Email cannot be cleared.' };
      plan.contact.email = next;
      plan.changes.push({ field: 'email', from: prev, to: next });
    }
  }

  if (patch.phones) {
    const next = [...new Set(patch.phones.map((phone) => normalizeContactPhone(phone)).filter((phone): phone is string => Boolean(phone)))];
    if (patch.phones.some((phone) => String(phone).trim()) && next.length === 0) {
      return { ok: false, error: 'Enter a valid phone number.' };
    }
    if (!sameList(contact.phones, next)) {
      if (!full && contact.phones.length) {
        return { ok: false, error: 'Phones are already set. Only a super admin can change them.' };
      }
      if (!next.length) return { ok: false, error: 'A contact needs at least one phone.' };
      plan.contact.phones = next;
      plan.changes.push({ field: 'phones', from: contact.phones.join(', '), to: next.join(', ') });
    }
  }

  if (patch.roles) {
    const next = parseRoles(patch.roles);
    if (!sameList(contact.roles, next)) {
      if (!full && contact.roles.length) {
        return { ok: false, error: 'Roles are already set. Only a super admin can change them.' };
      }
      if (!full && !next.length) return { ok: false, error: 'Roles cannot be cleared.' };
      plan.contact.roles = next;
      plan.changes.push({ field: 'roles', from: contact.roles.join(', '), to: next.join(', ') });
    }
  }

  const flagError = applyFlags(full, contact, patch, plan);
  if (flagError) return { ok: false, error: flagError };

  if (patch.complex != null && patch.complex.trim()) {
    const key = complexKey(patch.complex);
    if (!input.complexLinks.some((link) => link.complexKey === key)) {
      if (!full && input.complexLinks.length) {
        return { ok: false, error: 'Complex is already set. Only a super admin can change it.' };
      }
      plan.addComplexes.push(patch.complex.trim());
      plan.changes.push({ field: 'complex', from: '', to: patch.complex.trim() });
    }
  }

  const unitError = applyUnit(full, input.complexLinks, input.unitLinks, patch.unit, plan);
  if (unitError) return { ok: false, error: unitError };

  return { ok: true, plan };
}

function parseRoles(values: string[]): ContactRole[] {
  const roles: ContactRole[] = [];
  for (const value of values) {
    for (const part of String(value).split(/[/|,;]+/)) {
      const token = part.trim().toLowerCase();
      const role = CONTACT_ROLES.find((item) => item === token);
      if (role && !roles.includes(role)) roles.push(role);
    }
  }
  return roles;
}

function applyFlags(full: boolean, contact: Contact, patch: ContactPatch, plan: WritePlan): string | null {
  if (patch.do_not_call != null && patch.do_not_call !== contact.do_not_call) {
    if (!full) return 'Only a super admin can change flags. Use the DND outcome to mark do-not-call.';
    plan.contact.do_not_call = patch.do_not_call;
    plan.changes.push({ field: 'do_not_call', from: String(contact.do_not_call), to: String(patch.do_not_call) });
  }
  if (patch.opted_out != null && patch.opted_out !== contact.opted_out) {
    if (!full) return 'Only a super admin can change flags.';
    plan.contact.opted_out = patch.opted_out;
    plan.changes.push({ field: 'opted_out', from: String(contact.opted_out), to: String(patch.opted_out) });
  }
  if (patch.suspected_broker !== undefined) {
    const next = patch.suspected_broker === 'VERIFY' ? 'VERIFY' : null;
    if (next !== contact.suspected_broker) {
      if (!full) return 'Only a super admin can change the suspected-broker flag.';
      plan.contact.suspected_broker = next;
      plan.changes.push({ field: 'suspected_broker', from: contact.suspected_broker || '', to: next || '' });
    }
  }
  return null;
}

function applyUnit(
  full: boolean,
  complexLinks: Array<{ complexKey: string }>,
  unitLinks: UnitLinkView[],
  unit: ContactPatch['unit'],
  plan: WritePlan,
): string | null {
  if (!unit) return null;
  const target = unit.unitLinkId
    ? unitLinks.find((link) => link.id === unit.unitLinkId)
    : !unit.flat && unitLinks.length === 1 && (unit.agreementStart != null || unit.agreementEnd != null)
      ? unitLinks[0]
      : undefined;
  if (unit.unitLinkId && !target) return 'That unit link was not found.';
  if (target) {
    const update: NonNullable<WritePlan['updateLink']> = { id: target.id };
    const start = fillDate(full, 'Agreement start', target.agreementStart, unit.agreementStart, plan.changes);
    if (start.error) return start.error;
    if (start.value != null) update.agreementStart = start.value;
    const end = fillDate(full, 'Agreement end', target.agreementEnd, unit.agreementEnd, plan.changes);
    if (end.error) return end.error;
    if (end.value != null) update.agreementEnd = end.value;
    if (unit.relation) {
      const relation: UnitRelation = unit.relation === 'tenant' ? 'tenant' : 'owner';
      if (relation !== target.relation) {
        if (!full && target.relation) return 'Relation is already set. Only a super admin can change it.';
        update.relation = relation;
        plan.changes.push({ field: 'relation', from: target.relation, to: relation });
      }
    }
    if (unit.flat && unit.flat.trim() && unit.flat.trim().toLowerCase() !== target.flat.trim().toLowerCase()) {
      if (!full) return 'Flat number is already set. Only a super admin can change it.';
    }
    if (update.agreementStart != null || update.agreementEnd != null || update.relation) plan.updateLink = update;
    return null;
  }

  const flat = unit.flat?.trim() || '';
  if (!flat) return null;
  if (!full && unitLinks.length) return 'A unit is already linked. Only a super admin can change it.';
  const complex = unit.complex?.trim() || '';
  if (!complex) return 'A complex is required when adding a flat number.';
  const key = complexKey(complex);
  if (!full && complexLinks.length && !complexLinks.some((link) => link.complexKey === key)) {
    return 'Complex is already set. Only a super admin can change it.';
  }
  const relation: UnitRelation = unit.relation === 'tenant' ? 'tenant' : 'owner';
  plan.addUnit = {
    complex,
    tower: unit.tower?.trim() || '',
    flat,
    relation,
    agreementStart: unit.agreementStart?.trim() || '',
    agreementEnd: unit.agreementEnd?.trim() || '',
  };
  plan.changes.push({ field: 'flat', from: '', to: flat });
  if (!complexLinks.some((link) => link.complexKey === key)) {
    plan.addComplexes.push(complex);
    plan.changes.push({ field: 'complex', from: '', to: complex });
  }
  return null;
}

function fillDate(
  full: boolean,
  label: string,
  current: string,
  incoming: string | undefined,
  changes: InteractionChange[],
): { value?: string; error?: string } {
  if (incoming == null) return {};
  const next = incoming.trim();
  const prev = current.trim();
  if (next === prev) return {};
  if (!full && prev) return { error: `${label} is already set. Only a super admin can change it.` };
  if (!full && !next) return { error: `${label} cannot be cleared.` };
  changes.push({ field: label, from: prev, to: next });
  return { value: next };
}
