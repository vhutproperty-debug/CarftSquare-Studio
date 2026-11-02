import { normalizeLeaseDate } from '@/lib/ops/lease-expiries/types';
import { mergeField, unionRoles, type MergeConflict } from '@/lib/ops/contacts/merge';
import { splitPhones } from '@/lib/ops/contacts/phone';
import { CONTACT_ROLES, type ContactRole, type UnitRelation } from '@/lib/ops/contacts/types';

export const CANONICAL_FIELDS = [
  'name',
  'phone',
  'email',
  'role',
  'complex',
  'tower',
  'flat',
  'relation',
  'agreement_start',
  'agreement_end',
  'source',
  'do_not_call',
  'opted_out',
  'suspected_broker',
  'notes',
] as const;

export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

const ALIASES: Record<CanonicalField, string[]> = {
  name: ['name', 'owner', 'owner name', 'full name', 'contact', 'contact name'],
  phone: ['phone', 'mobile', 'phones', 'owner phone', 'whatsapp', 'wa', 'mobile number', 'phone number'],
  email: ['email', 'e-mail', 'mail', 'owner email'],
  role: ['role', 'roles', 'type', 'contact type'],
  complex: ['complex', 'project', 'building', 'society', 'project name'],
  tower: ['tower', 'wing', 'tower name'],
  flat: ['flat', 'unit', 'unit number', 'apartment', 'apt', 'flat no', 'flat number'],
  relation: ['relation', 'relationship', 'owner or tenant'],
  agreement_start: ['agreement start', 'lease start', 'start date', 'agreement_start'],
  agreement_end: ['agreement end', 'lease end', 'expiry', 'lease expiry', 'agreement_end', 'end date'],
  source: ['source'],
  do_not_call: ['dnd', 'do not call', 'do_not_call', 'do not contact'],
  opted_out: ['opted out', 'opt out', 'opted_out', 'unsubscribed'],
  suspected_broker: ['suspected broker', 'suspected_broker', 'broker flag'],
  notes: ['notes', 'note', 'remarks', 'remark', 'comment'],
};

export type IncomingUnit = {
  complex: string;
  tower: string;
  flat: string;
  relation: UnitRelation | '';
  agreementStart: string;
  agreementEnd: string;
};

export type IncomingContact = {
  name: string;
  phones: string[];
  email: string;
  roles: ContactRole[];
  complexes: string[];
  units: IncomingUnit[];
  source: string;
  doNotCall: boolean;
  optedOut: boolean;
  suspectedBroker: boolean;
  note: string;
};

function headerKey(value: string): string {
  return value.trim().toLowerCase().replace(/[_./]+/g, ' ').replace(/\s+/g, ' ');
}

export function suggestMapping(headers: string[]): {
  mapping: Partial<Record<CanonicalField, string>>;
  extraPhones: string[];
} {
  const mapping: Partial<Record<CanonicalField, string>> = {};
  const used = new Set<string>();
  const extraPhones: string[] = [];
  for (const header of headers) {
    const key = headerKey(header);
    if (!key) continue;
    let matched: CanonicalField | null = null;
    for (const field of CANONICAL_FIELDS) {
      if (ALIASES[field].includes(key)) {
        matched = field;
        break;
      }
    }
    if (!matched) continue;
    if (matched === 'phone' && mapping.phone) {
      extraPhones.push(header);
      continue;
    }
    if (mapping[matched]) continue;
    mapping[matched] = header;
    used.add(header);
  }
  void used;
  return { mapping, extraPhones };
}

function cell(record: Record<string, string>, key: string): string {
  return String(record[key] ?? '').trim();
}

function truthy(value: string): boolean {
  return ['1', 'true', 'yes', 'y', 'dnd'].includes(value.trim().toLowerCase());
}

export function parseRoles(value: string): ContactRole[] {
  const roles: ContactRole[] = [];
  for (const part of value.split(/[/|,;]+/)) {
    const token = part.trim().toLowerCase();
    if (!token) continue;
    const role = CONTACT_ROLES.find((item) => token === item || token.includes(item));
    if (role && !roles.includes(role)) roles.push(role);
  }
  return roles;
}

export function parseRelation(value: string, roles: ContactRole[]): UnitRelation | '' {
  const token = value.trim().toLowerCase();
  if (token === 'tenant' || token.includes('tenant')) return 'tenant';
  if (token === 'owner' || token.includes('owner')) return 'owner';
  if (!token && roles.includes('tenant') && !roles.includes('owner')) return 'tenant';
  return token ? '' : '';
}

export function incomingFromRecord(record: Record<string, string>): { incoming: IncomingContact; errors: string[] } {
  const phones = splitPhones([cell(record, 'phone'), cell(record, 'phone_2'), cell(record, 'phone_3')].filter(Boolean).join(' / '));
  const errors: string[] = [];
  if (!phones.length) errors.push('A valid phone number is required. Unit and email may be blank.');
  const roles = parseRoles(cell(record, 'role'));
  const complex = cell(record, 'complex');
  const tower = cell(record, 'tower');
  const flat = cell(record, 'flat');
  const relation = parseRelation(cell(record, 'relation'), roles);
  const agreementStart = normalizeLeaseDate(cell(record, 'agreement_start'));
  const agreementEnd = normalizeLeaseDate(cell(record, 'agreement_end'));
  const units: IncomingUnit[] = [];
  const complexes: string[] = [];
  if (flat) {
    if (!complex) errors.push('A complex is required when a flat number is present.');
    else {
      units.push({
        complex,
        tower,
        flat,
        relation: relation || (roles.includes('tenant') && !roles.includes('owner') ? 'tenant' : 'owner'),
        agreementStart,
        agreementEnd,
      });
    }
  } else if (complex) {
    complexes.push(complex);
  }
  return {
    incoming: {
      name: cell(record, 'name'),
      phones,
      email: cell(record, 'email').toLowerCase(),
      roles,
      complexes,
      units,
      source: cell(record, 'source') || 'import',
      doNotCall: truthy(cell(record, 'do_not_call')),
      optedOut: truthy(cell(record, 'opted_out')),
      suspectedBroker: truthy(cell(record, 'suspected_broker')) || cell(record, 'suspected_broker').trim().toUpperCase() === 'VERIFY',
      note: cell(record, 'notes'),
    },
    errors,
  };
}

function placeKey(complex: string, tower: string, flat: string): string {
  const key = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
  return `${key(complex)}|${key(tower)}|${key(flat)}`;
}

/** Combine two rows for the same phone. Filled values stay; disagreements are conflicts. */
export function foldIncomingContacts(base: IncomingContact, extra: IncomingContact): { next: IncomingContact; conflicts: MergeConflict[] } {
  const conflicts: MergeConflict[] = [];
  const name = mergeField(base.name, extra.name, 'name');
  if (name.conflict) conflicts.push(name.conflict);
  const email = mergeField(base.email, extra.email, 'email');
  if (email.conflict) conflicts.push(email.conflict);
  const roles = unionRoles(base.roles, extra.roles);
  const phones = [...base.phones];
  for (const phone of extra.phones) if (!phones.includes(phone)) phones.push(phone);
  const complexes = [...base.complexes];
  for (const complex of extra.complexes) {
    if (!complexes.some((item) => item.trim().toLowerCase() === complex.trim().toLowerCase())) complexes.push(complex);
  }
  const units = base.units.map((unit) => ({ ...unit }));
  for (const unit of extra.units) {
    const key = placeKey(unit.complex, unit.tower, unit.flat);
    const found = units.find((item) => placeKey(item.complex, item.tower, item.flat) === key);
    if (!found) {
      units.push({ ...unit });
      continue;
    }
    const start = mergeField(found.agreementStart, unit.agreementStart, 'agreement_start');
    if (start.conflict) conflicts.push(start.conflict);
    if (start.changed) found.agreementStart = start.value;
    const end = mergeField(found.agreementEnd, unit.agreementEnd, 'agreement_end');
    if (end.conflict) conflicts.push(end.conflict);
    if (end.changed) found.agreementEnd = end.value;
  }
  return {
    next: {
      ...base,
      name: name.value,
      email: email.value,
      roles: roles.roles,
      phones,
      complexes,
      units,
      doNotCall: base.doNotCall || extra.doNotCall,
      optedOut: base.optedOut || extra.optedOut,
      suspectedBroker: base.suspectedBroker || extra.suspectedBroker,
      source: base.source || extra.source,
      note: [base.note, extra.note].filter(Boolean).join('\n'),
    },
    conflicts,
  };
}

export function recordsFromTable(headers: string[], rows: string[][], mapping: Partial<Record<CanonicalField, string>>, extraPhones: string[] = []): Record<string, string>[] {
  const index = new Map(headers.map((header, position) => [header, position]));
  return rows.map((row) => {
    const record: Record<string, string> = {};
    for (const field of CANONICAL_FIELDS) {
      const header = mapping[field];
      if (!header) continue;
      const position = index.get(header);
      record[field] = position == null ? '' : String(row[position] ?? '').trim();
    }
    const extras = extraPhones.map((header) => {
      const position = index.get(header);
      return position == null ? '' : String(row[position] ?? '').trim();
    }).filter(Boolean);
    if (extras.length) record.phone = [record.phone, ...extras].filter(Boolean).join(' / ');
    return record;
  });
}
