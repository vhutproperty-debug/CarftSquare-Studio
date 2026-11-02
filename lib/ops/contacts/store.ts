import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { normalizeLeaseDate } from '@/lib/ops/lease-expiries/types';
import type { ContactActor } from '@/lib/ops/permissions';
import { ContactAccessError, ContactValidationError, isDuplicateKey } from '@/lib/ops/contacts/errors';
import { planContactWrite, type ContactPatch, type UnitLinkView } from '@/lib/ops/contacts/policy';
import { normalizeContactPhone } from '@/lib/ops/contacts/phone';
import { computeQueueBand, todayUtc } from '@/lib/ops/contacts/queue';
import {
  CALL_OUTCOMES,
  COMPLEX_LINKS_COLLECTION,
  CONTACT_INDEX_SPECS,
  CONTACT_ROLES,
  CONTACTS_COLLECTION,
  FAR_DATE,
  INTERACTIONS_COLLECTION,
  TASKS_COLLECTION,
  UNIT_LINKS_COLLECTION,
  UNITS_COLLECTION,
  type CallOutcome,
  type ComplexLink,
  type Contact,
  type ContactRole,
  type Interaction,
  type InteractionChange,
  type InteractionKind,
  type OpsTask,
  type UnitLink,
  type UnitRecord,
  type UnitRelation,
} from '@/lib/ops/contacts/types';
import { presentContact, type ContactView } from '@/lib/ops/contacts/view';

const ensured = new WeakSet<object>();

export function complexKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function unitKey(complex: string, tower: string, flat: string): string {
  return `${complexKey(complex)}|${complexKey(tower)}|${complexKey(flat)}`;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function bool(value: unknown): boolean {
  return value === true;
}

export function asContact(doc: Record<string, unknown>): Contact {
  const phones = Array.isArray(doc.phones) ? doc.phones.map((phone) => text(phone)).filter(Boolean) : [];
  const roles = Array.isArray(doc.roles)
    ? doc.roles.map((role) => text(role)).filter((role): role is ContactRole => (CONTACT_ROLES as readonly string[]).includes(role))
    : [];
  return {
    id: text(doc.id),
    name: text(doc.name),
    phones,
    email: text(doc.email),
    roles,
    do_not_call: bool(doc.do_not_call),
    opted_out: bool(doc.opted_out),
    suspected_broker: doc.suspected_broker === 'VERIFY' ? 'VERIFY' : null,
    wrong_number: bool(doc.wrong_number),
    source: text(doc.source),
    assignedTo: text(doc.assignedTo),
    lastOutcome: text(doc.lastOutcome),
    lastContactedAt: text(doc.lastContactedAt),
    unitCount: Number(doc.unitCount || 0),
    ownerUnitCount: Number(doc.ownerUnitCount || 0),
    nearestAgreementEnd: text(doc.nearestAgreementEnd) || FAR_DATE,
    queueBand: Number(doc.queueBand ?? 2),
    complexKeys: Array.isArray(doc.complexKeys) ? doc.complexKeys.map((item) => text(item)).filter(Boolean) : [],
    createdAt: text(doc.createdAt),
    updatedAt: text(doc.updatedAt),
    createdBy: text(doc.createdBy),
    updatedBy: text(doc.updatedBy),
  };
}

function asComplexLink(doc: Record<string, unknown>): ComplexLink {
  return {
    id: text(doc.id),
    contactId: text(doc.contactId),
    complex: text(doc.complex),
    complexKey: text(doc.complexKey),
    createdAt: text(doc.createdAt),
    createdBy: text(doc.createdBy),
    importJobId: text(doc.importJobId),
  };
}

function asUnit(doc: Record<string, unknown>): UnitRecord {
  return {
    id: text(doc.id),
    complex: text(doc.complex),
    complexKey: text(doc.complexKey),
    tower: text(doc.tower),
    towerKey: text(doc.towerKey),
    flat: text(doc.flat),
    flatKey: text(doc.flatKey),
    unitKey: text(doc.unitKey),
    createdAt: text(doc.createdAt),
    updatedAt: text(doc.updatedAt),
  };
}

function asUnitLink(doc: Record<string, unknown>): UnitLink {
  return {
    id: text(doc.id),
    contactId: text(doc.contactId),
    unitId: text(doc.unitId),
    relation: doc.relation === 'tenant' ? 'tenant' : 'owner',
    agreementStart: text(doc.agreementStart),
    agreementEnd: text(doc.agreementEnd),
    createdAt: text(doc.createdAt),
    updatedAt: text(doc.updatedAt),
    createdBy: text(doc.createdBy),
    importJobId: text(doc.importJobId),
  };
}

export function asInteraction(doc: Record<string, unknown>): Interaction {
  const changes = Array.isArray(doc.changes) ? doc.changes.map((item) => {
    const change = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return { field: text(change.field), from: text(change.from), to: text(change.to) };
  }) : [];
  return {
    id: text(doc.id),
    contactId: text(doc.contactId),
    kind: text(doc.kind) as InteractionKind,
    outcome: text(doc.outcome),
    note: text(doc.note),
    changes,
    actorId: text(doc.actorId),
    actorEmail: text(doc.actorEmail),
    actorName: text(doc.actorName),
    importJobId: text(doc.importJobId),
    createdAt: text(doc.createdAt),
  };
}

function asTask(doc: Record<string, unknown>): OpsTask {
  const type = doc.type === 'assignment' ? 'assignment' : 'callback';
  const status = doc.status === 'done' || doc.status === 'cancelled' ? doc.status : 'open';
  return {
    id: text(doc.id),
    contactId: text(doc.contactId),
    type,
    dueAt: text(doc.dueAt),
    assigneeId: text(doc.assigneeId),
    status,
    note: text(doc.note),
    createdBy: text(doc.createdBy),
    sourceInteractionId: text(doc.sourceInteractionId),
    createdAt: text(doc.createdAt),
    updatedAt: text(doc.updatedAt),
  };
}

export async function getContactsDb(): Promise<Db> {
  return getDb() as Promise<Db>;
}

export async function ensureContactIndexes(db: Db): Promise<void> {
  if (ensured.has(db)) return;
  for (const spec of CONTACT_INDEX_SPECS) {
    await db.collection(spec.collection).createIndex(spec.keys, spec.options || {});
  }
  ensured.add(db);
}

async function ready(db: Db): Promise<void> {
  await ensureContactIndexes(db);
}

export async function getContact(db: Db, id: string): Promise<Contact | null> {
  await ready(db);
  const doc = await db.collection(CONTACTS_COLLECTION).findOne({ id });
  return doc ? asContact(doc as Record<string, unknown>) : null;
}

export async function requireContact(db: Db, id: string): Promise<Contact> {
  const contact = await getContact(db, id);
  if (!contact) throw new ContactValidationError('Contact not found.');
  return contact;
}

async function linksFor(db: Db, contactId: string): Promise<{ complexes: ComplexLink[]; unitLinks: UnitLink[]; units: UnitRecord[] }> {
  const complexes = (await db.collection(COMPLEX_LINKS_COLLECTION).find({ contactId }).toArray()).map((doc) => asComplexLink(doc as Record<string, unknown>));
  const unitLinks = (await db.collection(UNIT_LINKS_COLLECTION).find({ contactId }).toArray()).map((doc) => asUnitLink(doc as Record<string, unknown>));
  const unitIds = unitLinks.map((link) => link.unitId);
  const units = unitIds.length
    ? (await db.collection(UNITS_COLLECTION).find({ id: { $in: unitIds } }).toArray()).map((doc) => asUnit(doc as Record<string, unknown>))
    : [];
  return { complexes, unitLinks, units };
}

export async function contactView(db: Db, contact: Contact): Promise<ContactView> {
  const links = await linksFor(db, contact.id);
  return presentContact(contact, links.complexes, links.unitLinks, links.units);
}

export async function findContactsByPhones(db: Db, phones: string[]): Promise<Contact[]> {
  await ready(db);
  if (!phones.length) return [];
  const docs = await db.collection(CONTACTS_COLLECTION).find({ phones: { $in: phones } }).limit(20).toArray();
  return docs.map((doc) => asContact(doc as Record<string, unknown>));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function listContacts(db: Db, filters: { q?: string; complex?: string; limit?: number } = {}): Promise<ContactView[]> {
  await ready(db);
  const limit = Math.min(Math.max(filters.limit || 50, 1), 100);
  const query: Record<string, unknown> = {};
  const and: Record<string, unknown>[] = [];
  if (filters.complex) and.push({ complexKeys: complexKey(filters.complex) });
  const q = filters.q?.trim() || '';
  if (q) {
    const phone = normalizeContactPhone(q);
    const ors: Record<string, unknown>[] = [{ name: { $regex: escapeRegex(q), $options: 'i' } }];
    if (phone) ors.push({ phones: phone });
    and.push({ $or: ors });
  }
  if (and.length === 1) Object.assign(query, and[0]);
  else if (and.length > 1) query.$and = and;
  const docs = await db.collection(CONTACTS_COLLECTION).find(query).sort({ updatedAt: -1, id: 1 }).limit(limit).toArray();
  const contacts = docs.map((doc) => asContact(doc as Record<string, unknown>));
  return Promise.all(contacts.map((contact) => contactView(db, contact)));
}

export async function listComplexNames(db: Db): Promise<string[]> {
  await ready(db);
  const collection = db.collection(COMPLEX_LINKS_COLLECTION) as unknown as {
    distinct?: (field: string, query?: Record<string, unknown>) => Promise<unknown[]>;
    find: (query: Record<string, unknown>) => { limit: (n: number) => { toArray: () => Promise<Array<Record<string, unknown>>> } };
  };
  if (typeof collection.distinct === 'function') {
    const values = await collection.distinct('complex', {});
    return values.map((value) => text(value)).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }
  const docs = await db.collection(COMPLEX_LINKS_COLLECTION).find({}).limit(5000).toArray();
  return [...new Set(docs.map((doc) => text((doc as Record<string, unknown>).complex)).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export async function listColdCallQueue(db: Db, filters: { complex?: string; assignedTo?: string; limit?: number } = {}): Promise<ContactView[]> {
  await ready(db);
  const limit = Math.min(Math.max(filters.limit || 40, 1), 100);
  const query: Record<string, unknown> = {
    do_not_call: { $ne: true },
    opted_out: { $ne: true },
    wrong_number: { $ne: true },
    queueBand: { $lte: 2 },
  };
  if (filters.complex) query.complexKeys = complexKey(filters.complex);
  if (filters.assignedTo === 'unassigned') query.assignedTo = '';
  else if (filters.assignedTo) query.assignedTo = filters.assignedTo;
  const docs = await db.collection(CONTACTS_COLLECTION).find(query).sort({
    queueBand: 1,
    ownerUnitCount: -1,
    nearestAgreementEnd: 1,
    lastContactedAt: 1,
    id: 1,
  }).limit(limit).toArray();
  const contacts = docs.map((doc) => asContact(doc as Record<string, unknown>));
  return Promise.all(contacts.map((contact) => contactView(db, contact)));
}

async function insertInteraction(db: Db, input: {
  contactId: string;
  kind: InteractionKind;
  outcome?: string;
  note?: string;
  changes?: InteractionChange[];
  actor: ContactActor;
  importJobId?: string;
  at?: string;
}): Promise<Interaction> {
  const interaction: Interaction = {
    id: randomUUID(),
    contactId: input.contactId,
    kind: input.kind,
    outcome: input.outcome || '',
    note: input.note?.trim() || '',
    changes: input.changes || [],
    actorId: input.actor.id,
    actorEmail: input.actor.email,
    actorName: input.actor.name,
    importJobId: input.importJobId || '',
    createdAt: input.at || new Date().toISOString(),
  };
  await db.collection(INTERACTIONS_COLLECTION).insertOne(interaction);
  return interaction;
}

export async function listInteractions(db: Db, contactId: string): Promise<Interaction[]> {
  await ready(db);
  const docs = await db.collection(INTERACTIONS_COLLECTION).find({ contactId }).sort({ createdAt: -1 }).limit(200).toArray();
  return docs.map((doc) => asInteraction(doc as Record<string, unknown>));
}

export async function listTasks(db: Db, contactId: string): Promise<OpsTask[]> {
  await ready(db);
  const docs = await db.collection(TASKS_COLLECTION).find({ contactId }).sort({ dueAt: 1 }).limit(100).toArray();
  return docs.map((doc) => asTask(doc as Record<string, unknown>));
}

export async function listDueCallbacks(db: Db, filters: { assignedTo?: string; today?: string } = {}): Promise<Array<OpsTask & { contactName: string; phones: string[] }>> {
  await ready(db);
  const today = filters.today || todayUtc();
  const query: Record<string, unknown> = { type: 'callback', status: 'open', dueAt: { $lte: today } };
  if (filters.assignedTo && filters.assignedTo !== 'unassigned') query.assigneeId = filters.assignedTo;
  const docs = await db.collection(TASKS_COLLECTION).find(query).sort({ dueAt: 1 }).limit(40).toArray();
  const tasks = docs.map((doc) => asTask(doc as Record<string, unknown>));
  const results = [];
  for (const task of tasks) {
    const contact = await getContact(db, task.contactId);
    if (!contact || contact.do_not_call || contact.opted_out) continue;
    if (filters.assignedTo === 'unassigned' && contact.assignedTo) continue;
    results.push({ ...task, contactName: contact.name, phones: contact.phones });
  }
  return results;
}

export async function ensureComplexLink(db: Db, contactId: string, complex: string, actorId: string, importJobId = ''): Promise<{ link: ComplexLink; created: boolean } | null> {
  const key = complexKey(complex);
  if (!key) return null;
  const existing = await db.collection(COMPLEX_LINKS_COLLECTION).findOne({ contactId, complexKey: key });
  if (existing) return { link: asComplexLink(existing as Record<string, unknown>), created: false };
  const link: ComplexLink = {
    id: randomUUID(),
    contactId,
    complex: complex.trim(),
    complexKey: key,
    createdAt: new Date().toISOString(),
    createdBy: actorId,
    importJobId,
  };
  await db.collection(COMPLEX_LINKS_COLLECTION).insertOne(link);
  return { link, created: true };
}

async function ensureUnit(db: Db, input: { complex: string; tower: string; flat: string }): Promise<{ unit: UnitRecord; created: boolean }> {
  const key = unitKey(input.complex, input.tower, input.flat);
  const existing = await db.collection(UNITS_COLLECTION).findOne({ unitKey: key });
  if (existing) return { unit: asUnit(existing as Record<string, unknown>), created: false };
  const now = new Date().toISOString();
  const unit: UnitRecord = {
    id: randomUUID(),
    complex: input.complex.trim(),
    complexKey: complexKey(input.complex),
    tower: input.tower.trim(),
    towerKey: complexKey(input.tower),
    flat: input.flat.trim(),
    flatKey: complexKey(input.flat),
    unitKey: key,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await db.collection(UNITS_COLLECTION).insertOne(unit);
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    const raced = await db.collection(UNITS_COLLECTION).findOne({ unitKey: key });
    if (raced) return { unit: asUnit(raced as Record<string, unknown>), created: false };
    throw error;
  }
  return { unit, created: true };
}

export async function linkContactToUnit(db: Db, input: {
  contactId: string;
  complex: string;
  tower: string;
  flat: string;
  relation: UnitRelation;
  agreementStart?: string;
  agreementEnd?: string;
  actorId: string;
  importJobId?: string;
}): Promise<{ unit: UnitRecord; link: UnitLink; createdUnit: boolean; createdLink: boolean }> {
  const { unit, created: createdUnit } = await ensureUnit(db, input);
  await ensureComplexLink(db, input.contactId, input.complex, input.actorId, input.importJobId || '');
  const existing = await db.collection(UNIT_LINKS_COLLECTION).findOne({ contactId: input.contactId, unitId: unit.id });
  if (existing) return { unit, link: asUnitLink(existing as Record<string, unknown>), createdUnit, createdLink: false };
  const now = new Date().toISOString();
  const link: UnitLink = {
    id: randomUUID(),
    contactId: input.contactId,
    unitId: unit.id,
    relation: input.relation,
    agreementStart: normalizeLeaseDate(input.agreementStart || '') || text(input.agreementStart),
    agreementEnd: normalizeLeaseDate(input.agreementEnd || '') || text(input.agreementEnd),
    createdAt: now,
    updatedAt: now,
    createdBy: input.actorId,
    importJobId: input.importJobId || '',
  };
  await db.collection(UNIT_LINKS_COLLECTION).insertOne(link);
  return { unit, link, createdUnit, createdLink: true };
}

export async function rebuildContactDerived(db: Db, contactId: string): Promise<Contact> {
  const contact = await requireContact(db, contactId);
  const { complexes, unitLinks } = await linksFor(db, contactId);
  const ends = unitLinks.map((link) => link.agreementEnd).filter(Boolean).sort();
  const ownerUnitCount = unitLinks.filter((link) => link.relation === 'owner').length;
  const nearestAgreementEnd = ends[0] || FAR_DATE;
  const queueBand = computeQueueBand({
    ownerUnitCount,
    nearestAgreementEnd,
    lastContactedAt: contact.lastContactedAt,
  });
  const next: Partial<Contact> = {
    unitCount: unitLinks.length,
    ownerUnitCount,
    nearestAgreementEnd,
    queueBand,
    complexKeys: [...new Set(complexes.map((link) => link.complexKey))],
    updatedAt: new Date().toISOString(),
  };
  await db.collection(CONTACTS_COLLECTION).updateOne({ id: contactId }, { $set: next });
  return { ...contact, ...next } as Contact;
}

async function saveNewContact(db: Db, contact: Contact): Promise<void> {
  try {
    await db.collection(CONTACTS_COLLECTION).insertOne(contact);
  } catch (error) {
    if (isDuplicateKey(error)) throw new ContactValidationError('That phone already belongs to another contact.');
    throw error;
  }
}

export async function createContact(db: Db, actor: ContactActor, input: ContactPatch & { source?: string }): Promise<ContactView> {
  await ready(db);
  const phones = [...new Set((input.phones || []).map((phone) => normalizeContactPhone(phone)).filter((phone): phone is string => Boolean(phone)))];
  if (!phones.length) throw new ContactValidationError('A valid phone number is required.');
  const owned = await findContactsByPhones(db, phones);
  if (owned.length) throw new ContactValidationError('That phone already belongs to another contact.');
  const now = new Date().toISOString();
  const contact: Contact = {
    id: randomUUID(),
    name: text(input.name).trim(),
    phones,
    email: text(input.email).trim().toLowerCase(),
    roles: (input.roles || []).map((role) => text(role).toLowerCase()).filter((role): role is ContactRole => (CONTACT_ROLES as readonly string[]).includes(role)),
    do_not_call: input.do_not_call === true,
    opted_out: input.opted_out === true,
    suspected_broker: input.suspected_broker === 'VERIFY' ? 'VERIFY' : null,
    wrong_number: false,
    source: text(input.source) || 'manual',
    assignedTo: '',
    lastOutcome: '',
    lastContactedAt: '',
    unitCount: 0,
    ownerUnitCount: 0,
    nearestAgreementEnd: FAR_DATE,
    queueBand: 2,
    complexKeys: [],
    createdAt: now,
    updatedAt: now,
    createdBy: actor.email,
    updatedBy: actor.email,
  };
  await saveNewContact(db, contact);
  if (input.complex?.trim()) await ensureComplexLink(db, contact.id, input.complex, actor.id);
  if (input.unit?.flat && input.unit.complex) {
    await linkContactToUnit(db, {
      contactId: contact.id,
      complex: input.unit.complex,
      tower: input.unit.tower || '',
      flat: input.unit.flat,
      relation: input.unit.relation === 'tenant' ? 'tenant' : 'owner',
      agreementStart: input.unit.agreementStart,
      agreementEnd: input.unit.agreementEnd,
      actorId: actor.id,
    });
  }
  await insertInteraction(db, {
    contactId: contact.id,
    kind: 'system',
    note: 'Contact created',
    actor,
  });
  const rebuilt = await rebuildContactDerived(db, contact.id);
  return contactView(db, rebuilt);
}

function unitViews(unitLinks: UnitLink[], units: UnitRecord[]): UnitLinkView[] {
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  return unitLinks.map((link) => {
    const unit = byId.get(link.unitId);
    return {
      id: link.id,
      unitId: link.unitId,
      relation: link.relation,
      agreementStart: link.agreementStart,
      agreementEnd: link.agreementEnd,
      complex: unit?.complex || '',
      tower: unit?.tower || '',
      flat: unit?.flat || '',
    };
  });
}

export async function patchContact(db: Db, actor: ContactActor, full: boolean, id: string, patch: ContactPatch): Promise<{ contact: ContactView; changes: InteractionChange[] }> {
  await ready(db);
  const contact = await requireContact(db, id);
  const links = await linksFor(db, id);
  const planned = planContactWrite({
    full,
    contact,
    complexLinks: links.complexes,
    unitLinks: unitViews(links.unitLinks, links.units),
    patch,
  });
  if (planned.ok === false) throw new ContactAccessError(planned.error);
  const plan = planned.plan;
  if (plan.contact.phones) {
    const owned = await findContactsByPhones(db, plan.contact.phones);
    if (owned.some((item) => item.id !== id)) throw new ContactValidationError('That phone already belongs to another contact.');
  }
  if (Object.keys(plan.contact).length) {
    await db.collection(CONTACTS_COLLECTION).updateOne({ id }, {
      $set: { ...plan.contact, updatedAt: new Date().toISOString(), updatedBy: actor.email },
    });
  }
  for (const complex of plan.addComplexes) {
    await ensureComplexLink(db, id, complex, actor.id);
  }
  if (plan.addUnit) {
    await linkContactToUnit(db, { contactId: id, ...plan.addUnit, actorId: actor.id });
  }
  if (plan.updateLink) {
    const set: Record<string, string> = { updatedAt: new Date().toISOString() };
    if (plan.updateLink.agreementStart != null) set.agreementStart = normalizeLeaseDate(plan.updateLink.agreementStart) || plan.updateLink.agreementStart;
    if (plan.updateLink.agreementEnd != null) set.agreementEnd = normalizeLeaseDate(plan.updateLink.agreementEnd) || plan.updateLink.agreementEnd;
    if (plan.updateLink.relation) set.relation = plan.updateLink.relation;
    await db.collection(UNIT_LINKS_COLLECTION).updateOne({ id: plan.updateLink.id }, { $set: set });
  }
  if (plan.changes.length) {
    await insertInteraction(db, {
      contactId: id,
      kind: 'field_fill',
      note: full ? 'Contact fields updated' : 'Empty fields filled',
      changes: plan.changes,
      actor,
    });
  }
  const rebuilt = await rebuildContactDerived(db, id);
  return { contact: await contactView(db, rebuilt), changes: plan.changes };
}

export async function deleteContact(db: Db, id: string): Promise<void> {
  await ready(db);
  const contact = await requireContact(db, id);
  if (contact.suspected_broker === 'VERIFY') {
    throw new ContactAccessError('This contact is flagged VERIFY as a suspected broker and cannot be deleted.');
  }
  const { unitLinks } = await linksFor(db, id);
  await db.collection(COMPLEX_LINKS_COLLECTION).deleteMany({ contactId: id });
  await db.collection(UNIT_LINKS_COLLECTION).deleteMany({ contactId: id });
  await db.collection(INTERACTIONS_COLLECTION).deleteMany({ contactId: id });
  await db.collection(TASKS_COLLECTION).deleteMany({ contactId: id });
  await db.collection(CONTACTS_COLLECTION).deleteOne({ id });
  for (const link of unitLinks) {
    const remaining = await db.collection(UNIT_LINKS_COLLECTION).countDocuments({ unitId: link.unitId });
    if (!remaining) await db.collection(UNITS_COLLECTION).deleteOne({ id: link.unitId });
  }
}

export async function addNote(db: Db, actor: ContactActor, id: string, note: string): Promise<Interaction> {
  await ready(db);
  await requireContact(db, id);
  const textNote = note.trim();
  if (!textNote) throw new ContactValidationError('A note is required.');
  return insertInteraction(db, { contactId: id, kind: 'note', note: textNote, actor });
}

export async function recordCallTap(db: Db, actor: ContactActor, id: string, phone: string): Promise<Interaction> {
  await ready(db);
  const contact = await requireContact(db, id);
  const normalized = normalizeContactPhone(phone) || phone.trim();
  if (!normalized) throw new ContactValidationError('A phone number is required.');
  if (contact.phones.length && !contact.phones.includes(normalized)) {
    throw new ContactValidationError('That number is not on this contact.');
  }
  return insertInteraction(db, {
    contactId: id,
    kind: 'call',
    note: 'Opened the dialer',
    changes: [{ field: 'phone', from: '', to: normalized }],
    actor,
  });
}

export async function recordOutcome(db: Db, actor: ContactActor, id: string, input: {
  outcome: string;
  note?: string;
  callbackOn?: string;
}): Promise<{ contact: ContactView; interaction: Interaction; task: OpsTask | null }> {
  await ready(db);
  const contact = await requireContact(db, id);
  if (!(CALL_OUTCOMES as readonly string[]).includes(input.outcome)) {
    throw new ContactValidationError('Choose interested, callback, not interested, wrong number, or DND.');
  }
  const outcome = input.outcome as CallOutcome;
  const callbackOn = input.callbackOn ? normalizeLeaseDate(input.callbackOn) || input.callbackOn.trim() : '';
  if (outcome === 'callback' && !/^\d{4}-\d{2}-\d{2}$/.test(callbackOn)) {
    throw new ContactValidationError('A callback date is required.');
  }
  const now = new Date().toISOString();
  const set: Record<string, unknown> = {
    lastOutcome: outcome,
    lastContactedAt: now,
    updatedAt: now,
    updatedBy: actor.email,
  };
  if (outcome === 'dnd') set.do_not_call = true;
  if (outcome === 'wrong_number') set.wrong_number = true;
  await db.collection(CONTACTS_COLLECTION).updateOne({ id }, { $set: set });
  const interaction = await insertInteraction(db, {
    contactId: id,
    kind: 'outcome',
    outcome,
    note: input.note?.trim() || '',
    changes: [
      { field: 'lastOutcome', from: contact.lastOutcome, to: outcome },
      ...(outcome === 'dnd' ? [{ field: 'do_not_call', from: String(contact.do_not_call), to: 'true' }] : []),
      ...(outcome === 'wrong_number' ? [{ field: 'wrong_number', from: String(contact.wrong_number), to: 'true' }] : []),
      ...(outcome === 'callback' ? [{ field: 'callbackOn', from: '', to: callbackOn }] : []),
    ],
    actor,
  });
  let task: OpsTask | null = null;
  if (outcome === 'callback') {
    task = {
      id: randomUUID(),
      contactId: id,
      type: 'callback',
      dueAt: callbackOn,
      assigneeId: contact.assignedTo || actor.id,
      status: 'open',
      note: input.note?.trim() || '',
      createdBy: actor.id,
      sourceInteractionId: interaction.id,
      createdAt: now,
      updatedAt: now,
    };
    await db.collection(TASKS_COLLECTION).insertOne(task);
  }
  const rebuilt = await rebuildContactDerived(db, id);
  return { contact: await contactView(db, rebuilt), interaction, task };
}

export async function assignContact(db: Db, actor: ContactActor, id: string, assigneeId: string): Promise<ContactView> {
  await ready(db);
  const contact = await requireContact(db, id);
  const next = assigneeId.trim();
  if (next === contact.assignedTo) return contactView(db, contact);
  const now = new Date().toISOString();
  await db.collection(CONTACTS_COLLECTION).updateOne({ id }, {
    $set: { assignedTo: next, updatedAt: now, updatedBy: actor.email },
  });
  await db.collection(TASKS_COLLECTION).updateMany(
    { contactId: id, type: 'assignment', status: 'open' },
    { $set: { status: 'cancelled', updatedAt: now } },
  );
  const interaction = await insertInteraction(db, {
    contactId: id,
    kind: 'assign',
    note: next ? 'Assigned for follow-up' : 'Assignment cleared',
    changes: [{ field: 'assignedTo', from: contact.assignedTo, to: next }],
    actor,
  });
  if (next) {
    const task: OpsTask = {
      id: randomUUID(),
      contactId: id,
      type: 'assignment',
      dueAt: todayUtc(),
      assigneeId: next,
      status: 'open',
      note: '',
      createdBy: actor.id,
      sourceInteractionId: interaction.id,
      createdAt: now,
      updatedAt: now,
    };
    await db.collection(TASKS_COLLECTION).insertOne(task);
  }
  return contactView(db, await getContact(db, id) as Contact);
}

export { insertInteraction };
