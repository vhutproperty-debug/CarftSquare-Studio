import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
import type { ContactActor } from '@/lib/ops/permissions';
import { foldIncomingContacts, incomingFromRecord, type IncomingContact } from '@/lib/ops/contacts/columns';
import { ContactValidationError } from '@/lib/ops/contacts/errors';
import { mergeField, stickyFlag, unionRoles, type MergeConflict } from '@/lib/ops/contacts/merge';
import {
  complexKey,
  ensureComplexLink,
  ensureContactIndexes,
  findContactsByPhones,
  insertInteraction,
  linkContactToUnit,
  rebuildContactDerived,
  requireContact,
  unitKey,
} from '@/lib/ops/contacts/store';
import {
  CONTACT_IMPORT_JOBS_COLLECTION,
  CONTACT_IMPORT_JOURNAL_COLLECTION,
  CONTACT_IMPORT_ROWS_COLLECTION,
  CONTACTS_COLLECTION,
  FAR_DATE,
  IMPORT_COMMIT_LIMIT,
  IMPORT_STAGE_LIMIT,
  INTERACTIONS_COLLECTION,
  UNIT_LINKS_COLLECTION,
  UNITS_COLLECTION,
  COMPLEX_LINKS_COLLECTION,
  type Contact,
  type InteractionChange,
  UPSERT_LIMIT,
} from '@/lib/ops/contacts/types';

export type ImportCounts = {
  staged: number;
  invalid: number;
  folded: number;
  conflicts: number;
  committed: number;
  created: number;
  merged: number;
  skipped: number;
};

export type ImportJob = {
  id: string;
  filename: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  status: 'open' | 'committed' | 'undone';
  counts: ImportCounts;
};

export type StagedRow = {
  id: string;
  jobId: string;
  index: number;
  phoneKeys: string[];
  normalized: IncomingContact | null;
  errors: string[];
  dedupe: 'invalid' | 'new' | 'merge' | 'conflict' | 'folded';
  conflicts: MergeConflict[];
  existingContactId: string;
  foldedInto: string;
  hasConflict: boolean;
  apply: boolean;
  status: 'staged' | 'committed' | 'skipped' | 'undone';
};

type Journal = {
  id: string;
  jobId: string;
  seq: number;
  contactId: string;
  created: boolean;
  before: Contact | null;
  createdComplexLinkIds: string[];
  createdUnitIds: string[];
  createdUnitLinkIds: string[];
  createdInteractionIds: string[];
};

function emptyCounts(): ImportCounts {
  return { staged: 0, invalid: 0, folded: 0, conflicts: 0, committed: 0, created: 0, merged: 0, skipped: 0 };
}

function asJob(doc: Record<string, unknown>): ImportJob {
  const counts = doc.counts && typeof doc.counts === 'object' ? doc.counts as ImportCounts : emptyCounts();
  return {
    id: String(doc.id || ''),
    filename: String(doc.filename || ''),
    createdBy: String(doc.createdBy || ''),
    createdAt: String(doc.createdAt || ''),
    updatedAt: String(doc.updatedAt || ''),
    status: doc.status === 'committed' || doc.status === 'undone' ? doc.status : 'open',
    counts: { ...emptyCounts(), ...counts },
  };
}

function asRow(doc: Record<string, unknown>): StagedRow {
  return {
    id: String(doc.id || ''),
    jobId: String(doc.jobId || ''),
    index: Number(doc.index || 0),
    phoneKeys: Array.isArray(doc.phoneKeys) ? doc.phoneKeys.map(String) : [],
    normalized: doc.normalized && typeof doc.normalized === 'object' ? doc.normalized as IncomingContact : null,
    errors: Array.isArray(doc.errors) ? doc.errors.map(String) : [],
    dedupe: (['invalid', 'new', 'merge', 'conflict', 'folded'].includes(String(doc.dedupe)) ? doc.dedupe : 'invalid') as StagedRow['dedupe'],
    conflicts: Array.isArray(doc.conflicts) ? doc.conflicts as MergeConflict[] : [],
    existingContactId: String(doc.existingContactId || ''),
    foldedInto: String(doc.foldedInto || ''),
    hasConflict: doc.hasConflict === true,
    apply: doc.apply === true,
    status: doc.status === 'committed' || doc.status === 'skipped' || doc.status === 'undone' ? doc.status : 'staged',
  };
}

export async function createImportJob(db: Db, actor: ContactActor, filename: string): Promise<ImportJob> {
  await ensureContactIndexes(db);
  const now = new Date().toISOString();
  const job: ImportJob = {
    id: randomUUID(),
    filename: filename.trim() || 'contacts',
    createdBy: actor.email,
    createdAt: now,
    updatedAt: now,
    status: 'open',
    counts: emptyCounts(),
  };
  await db.collection(CONTACT_IMPORT_JOBS_COLLECTION).insertOne(job);
  return job;
}

async function requireJob(db: Db, id: string): Promise<ImportJob> {
  await ensureContactIndexes(db);
  const doc = await db.collection(CONTACT_IMPORT_JOBS_COLLECTION).findOne({ id });
  if (!doc) throw new ContactValidationError('Import job not found.');
  return asJob(doc as Record<string, unknown>);
}

async function saveJob(db: Db, job: ImportJob): Promise<void> {
  job.updatedAt = new Date().toISOString();
  await db.collection(CONTACT_IMPORT_JOBS_COLLECTION).updateOne({ id: job.id }, { $set: job });
}

export async function stageImportRows(db: Db, jobId: string, startIndex: number, records: Array<Record<string, string>>): Promise<{
  job: ImportJob;
  accepted: number;
  invalid: number;
  folded: number;
  duplicates: number;
}> {
  if (records.length > IMPORT_STAGE_LIMIT) {
    throw new ContactValidationError(`Send at most ${IMPORT_STAGE_LIMIT} rows per batch.`);
  }
  const job = await requireJob(db, jobId);
  if (job.status !== 'open') throw new ContactValidationError('This import is already finished.');
  let accepted = 0;
  let invalid = 0;
  let folded = 0;
  let duplicates = 0;
  for (let offset = 0; offset < records.length; offset += 1) {
    const index = startIndex + offset;
    const id = `${jobId}:${index}`;
    const existing = await db.collection(CONTACT_IMPORT_ROWS_COLLECTION).findOne({ id });
    if (existing) {
      duplicates += 1;
      continue;
    }
    const parsed = incomingFromRecord(records[offset] || {});
    if (parsed.errors.length || !parsed.incoming.phones.length) {
      await insertRow(db, {
        id,
        jobId,
        index,
        phoneKeys: parsed.incoming.phones,
        normalized: null,
        errors: parsed.errors.length ? parsed.errors : ['A valid phone number is required. Unit and email may be blank.'],
        dedupe: 'invalid',
        conflicts: [],
        existingContactId: '',
        foldedInto: '',
        hasConflict: false,
        apply: false,
        status: 'staged',
      });
      job.counts.staged += 1;
      job.counts.invalid += 1;
      invalid += 1;
      continue;
    }
    const incoming = parsed.incoming;
    const primaries = (await db.collection(CONTACT_IMPORT_ROWS_COLLECTION).find({
      jobId,
      apply: true,
      phoneKeys: { $in: incoming.phones },
    }).toArray()).map((doc) => asRow(doc as Record<string, unknown>));
    const distinct = [...new Map(primaries.map((row) => [row.id, row])).values()];
    if (distinct.length > 1) {
      await insertRow(db, blankConflict(id, jobId, index, incoming, [{
        field: 'phone',
        existing: 'multiple rows in this file',
        incoming: incoming.phones.join(', '),
      }], 'Phones in this row match different contacts in the file.'));
      job.counts.staged += 1;
      job.counts.conflicts += 1;
      accepted += 1;
      continue;
    }
    if (distinct.length === 1) {
      const primary = distinct[0];
      const foldedContact = foldIncomingContacts(primary.normalized as IncomingContact, incoming);
      const conflicts = [...primary.conflicts, ...foldedContact.conflicts];
      await db.collection(CONTACT_IMPORT_ROWS_COLLECTION).updateOne({ id: primary.id }, {
        $set: {
          normalized: foldedContact.next,
          phoneKeys: foldedContact.next.phones,
          conflicts,
          hasConflict: conflicts.length > 0,
          dedupe: conflicts.length ? 'conflict' : primary.dedupe,
        },
      });
      await insertRow(db, {
        id,
        jobId,
        index,
        phoneKeys: incoming.phones,
        normalized: null,
        errors: [],
        dedupe: 'folded',
        conflicts: foldedContact.conflicts,
        existingContactId: primary.existingContactId,
        foldedInto: primary.id,
        hasConflict: foldedContact.conflicts.length > 0,
        apply: false,
        status: 'staged',
      });
      job.counts.staged += 1;
      job.counts.folded += 1;
      if (conflicts.length && !primary.hasConflict) job.counts.conflicts += 1;
      folded += 1;
      accepted += 1;
      continue;
    }
    const matches = await findContactsByPhones(db, incoming.phones);
    const ids = [...new Set(matches.map((contact) => contact.id))];
    if (ids.length > 1) {
      await insertRow(db, blankConflict(id, jobId, index, incoming, [{
        field: 'phone',
        existing: 'multiple contacts',
        incoming: incoming.phones.join(', '),
      }], 'These phones belong to different contacts.'));
      job.counts.staged += 1;
      job.counts.conflicts += 1;
      accepted += 1;
      continue;
    }
    const existingContact = ids.length === 1 ? matches.find((contact) => contact.id === ids[0]) || null : null;
    const conflicts = existingContact ? previewConflicts(existingContact, incoming) : [];
    await insertRow(db, {
      id,
      jobId,
      index,
      phoneKeys: incoming.phones,
      normalized: incoming,
      errors: [],
      dedupe: conflicts.length ? 'conflict' : existingContact ? 'merge' : 'new',
      conflicts,
      existingContactId: existingContact?.id || '',
      foldedInto: '',
      hasConflict: conflicts.length > 0,
      apply: true,
      status: 'staged',
    });
    job.counts.staged += 1;
    if (conflicts.length) job.counts.conflicts += 1;
    accepted += 1;
  }
  await saveJob(db, job);
  return { job, accepted, invalid, folded, duplicates };
}

function blankConflict(id: string, jobId: string, index: number, incoming: IncomingContact, conflicts: MergeConflict[], error: string): StagedRow {
  return {
    id,
    jobId,
    index,
    phoneKeys: incoming.phones,
    normalized: incoming,
    errors: [error],
    dedupe: 'conflict',
    conflicts,
    existingContactId: '',
    foldedInto: '',
    hasConflict: true,
    apply: false,
    status: 'staged',
  };
}

function previewConflicts(contact: Contact, incoming: IncomingContact): MergeConflict[] {
  const conflicts: MergeConflict[] = [];
  const name = mergeField(contact.name, incoming.name, 'name');
  if (name.conflict) conflicts.push(name.conflict);
  const email = mergeField(contact.email, incoming.email, 'email');
  if (email.conflict) conflicts.push(email.conflict);
  return conflicts;
}

async function insertRow(db: Db, row: StagedRow): Promise<void> {
  await db.collection(CONTACT_IMPORT_ROWS_COLLECTION).insertOne(row);
}

export async function getImportReport(db: Db, jobId: string): Promise<{
  job: ImportJob;
  conflicts: StagedRow[];
  merges: StagedRow[];
  created: StagedRow[];
  remaining: number;
}> {
  const job = await requireJob(db, jobId);
  const conflicts = (await db.collection(CONTACT_IMPORT_ROWS_COLLECTION).find({ jobId, hasConflict: true }).sort({ index: 1 }).limit(20).toArray()).map((doc) => asRow(doc as Record<string, unknown>));
  const merges = (await db.collection(CONTACT_IMPORT_ROWS_COLLECTION).find({ jobId, dedupe: 'merge', apply: true }).sort({ index: 1 }).limit(8).toArray()).map((doc) => asRow(doc as Record<string, unknown>));
  const created = (await db.collection(CONTACT_IMPORT_ROWS_COLLECTION).find({ jobId, dedupe: 'new', apply: true }).sort({ index: 1 }).limit(8).toArray()).map((doc) => asRow(doc as Record<string, unknown>));
  const remaining = await db.collection(CONTACT_IMPORT_ROWS_COLLECTION).countDocuments({ jobId, apply: true, status: 'staged' });
  return { job, conflicts, merges, created, remaining };
}

export async function commitImportJob(db: Db, actor: ContactActor, jobId: string, limit = IMPORT_COMMIT_LIMIT): Promise<{
  job: ImportJob;
  processed: number;
  remaining: number;
  results: Array<{ index: number; action: string; contactId: string; conflicts: MergeConflict[]; errors: string[] }>;
}> {
  const job = await requireJob(db, jobId);
  if (job.status === 'undone') throw new ContactValidationError('This import was undone.');
  if (job.status === 'committed') {
    return { job, processed: 0, remaining: 0, results: [] };
  }
  const size = Math.min(Math.max(limit, 1), IMPORT_COMMIT_LIMIT);
  const rows = (await db.collection(CONTACT_IMPORT_ROWS_COLLECTION).find({ jobId, apply: true, status: 'staged' }).sort({ index: 1 }).limit(size).toArray()).map((doc) => asRow(doc as Record<string, unknown>));
  const results = [];
  for (const row of rows) {
    if (!row.normalized) {
      await db.collection(CONTACT_IMPORT_ROWS_COLLECTION).updateOne({ id: row.id }, { $set: { status: 'skipped' } });
      job.counts.skipped += 1;
      results.push({ index: row.index, action: 'skipped', contactId: '', conflicts: row.conflicts, errors: row.errors });
      continue;
    }
    const applied = await applyIncoming(db, row.normalized, actor, job.id);
    const conflicts = [...row.conflicts, ...applied.conflicts];
    await db.collection(CONTACT_IMPORT_ROWS_COLLECTION).updateOne({ id: row.id }, {
      $set: {
        status: applied.action === 'skipped' ? 'skipped' : 'committed',
        conflicts,
        hasConflict: conflicts.length > 0,
        existingContactId: applied.contactId,
      },
    });
    job.counts.committed += 1;
    if (applied.action === 'created') job.counts.created += 1;
    else if (applied.action === 'merged' || applied.action === 'unchanged') job.counts.merged += 1;
    else job.counts.skipped += 1;
    results.push({ index: row.index, action: applied.action, contactId: applied.contactId, conflicts: applied.conflicts, errors: applied.errors });
  }
  const remaining = await db.collection(CONTACT_IMPORT_ROWS_COLLECTION).countDocuments({ jobId, apply: true, status: 'staged' });
  if (remaining === 0) job.status = 'committed';
  await saveJob(db, job);
  return { job, processed: rows.length, remaining, results };
}

export async function undoImportJob(db: Db, jobId: string): Promise<ImportJob> {
  const job = await requireJob(db, jobId);
  if (job.status === 'undone') return job;
  const journals = (await db.collection(CONTACT_IMPORT_JOURNAL_COLLECTION).find({ jobId }).sort({ seq: -1 }).limit(5000).toArray()) as unknown as Journal[];
  for (const journal of journals) {
    if (journal.createdInteractionIds?.length) {
      await db.collection(INTERACTIONS_COLLECTION).deleteMany({ id: { $in: journal.createdInteractionIds } });
    }
    if (journal.createdUnitLinkIds?.length) {
      await db.collection(UNIT_LINKS_COLLECTION).deleteMany({ id: { $in: journal.createdUnitLinkIds } });
    }
    for (const unitId of journal.createdUnitIds || []) {
      const remaining = await db.collection(UNIT_LINKS_COLLECTION).countDocuments({ unitId });
      if (!remaining) await db.collection(UNITS_COLLECTION).deleteOne({ id: unitId });
    }
    if (journal.createdComplexLinkIds?.length) {
      await db.collection(COMPLEX_LINKS_COLLECTION).deleteMany({ id: { $in: journal.createdComplexLinkIds } });
    }
    if (journal.created) {
      await db.collection(INTERACTIONS_COLLECTION).deleteMany({ contactId: journal.contactId, importJobId: jobId });
      await db.collection(COMPLEX_LINKS_COLLECTION).deleteMany({ contactId: journal.contactId, importJobId: jobId });
      await db.collection(UNIT_LINKS_COLLECTION).deleteMany({ contactId: journal.contactId, importJobId: jobId });
      await db.collection(CONTACTS_COLLECTION).deleteOne({ id: journal.contactId });
    } else if (journal.before) {
      await db.collection(CONTACTS_COLLECTION).updateOne({ id: journal.contactId }, { $set: journal.before });
      await rebuildContactDerived(db, journal.contactId);
    }
  }
  await db.collection(CONTACT_IMPORT_ROWS_COLLECTION).updateMany({ jobId, status: 'committed' }, { $set: { status: 'undone' } });
  job.status = 'undone';
  await saveJob(db, job);
  return job;
}

export async function applyIncoming(db: Db, incoming: IncomingContact, actor: ContactActor, jobId: string | null): Promise<{
  action: 'created' | 'merged' | 'unchanged' | 'skipped';
  contactId: string;
  conflicts: MergeConflict[];
  errors: string[];
}> {
  await ensureContactIndexes(db);
  if (!incoming.phones.length) {
    return { action: 'skipped', contactId: '', conflicts: [], errors: ['A valid phone number is required.'] };
  }
  const matches = await findContactsByPhones(db, incoming.phones);
  const ids = [...new Set(matches.map((contact) => contact.id))];
  if (ids.length > 1) {
    return {
      action: 'skipped',
      contactId: '',
      conflicts: [{ field: 'phone', existing: 'multiple contacts', incoming: incoming.phones.join(', ') }],
      errors: ['These phones belong to different contacts.'],
    };
  }
  if (!ids.length) return createFromIncoming(db, incoming, actor, jobId);
  return mergeFromIncoming(db, ids[0], incoming, actor, jobId);
}

async function createFromIncoming(db: Db, incoming: IncomingContact, actor: ContactActor, jobId: string | null): Promise<{
  action: 'created';
  contactId: string;
  conflicts: MergeConflict[];
  errors: string[];
}> {
  const now = new Date().toISOString();
  const contact: Contact = {
    id: randomUUID(),
    name: incoming.name,
    phones: [...incoming.phones],
    email: incoming.email,
    roles: [...incoming.roles],
    do_not_call: incoming.doNotCall,
    opted_out: incoming.optedOut,
    suspected_broker: incoming.suspectedBroker ? 'VERIFY' : null,
    wrong_number: false,
    source: incoming.source || 'import',
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
  await db.collection(CONTACTS_COLLECTION).insertOne(contact);
  const journal = emptyJournal(jobId, contact.id, true, null);
  for (const complex of incoming.complexes) {
    const linked = await ensureComplexLink(db, contact.id, complex, actor.id, jobId || '');
    if (linked?.created) journal.createdComplexLinkIds.push(linked.link.id);
  }
  for (const unit of incoming.units) {
    const linked = await linkContactToUnit(db, {
      contactId: contact.id,
      complex: unit.complex,
      tower: unit.tower,
      flat: unit.flat,
      relation: unit.relation === 'tenant' ? 'tenant' : 'owner',
      agreementStart: unit.agreementStart,
      agreementEnd: unit.agreementEnd,
      actorId: actor.id,
      importJobId: jobId || '',
    });
    if (linked.createdUnit) journal.createdUnitIds.push(linked.unit.id);
    if (linked.createdLink) journal.createdUnitLinkIds.push(linked.link.id);
    const complexLink = await db.collection(COMPLEX_LINKS_COLLECTION).findOne({ contactId: contact.id, complexKey: complexKey(unit.complex), importJobId: jobId || '' });
    if (complexLink && !journal.createdComplexLinkIds.includes(String((complexLink as { id?: string }).id))) {
      journal.createdComplexLinkIds.push(String((complexLink as { id?: string }).id));
    }
  }
  const interaction = await insertInteraction(db, {
    contactId: contact.id,
    kind: 'import',
    note: incoming.note || 'Created from import',
    changes: [
      { field: 'name', from: '', to: contact.name },
      { field: 'phones', from: '', to: contact.phones.join(', ') },
    ],
    actor,
    importJobId: jobId || '',
  });
  journal.createdInteractionIds.push(interaction.id);
  await rememberJournal(db, journal);
  await rebuildContactDerived(db, contact.id);
  return { action: 'created', contactId: contact.id, conflicts: [], errors: [] };
}

async function mergeFromIncoming(db: Db, contactId: string, incoming: IncomingContact, actor: ContactActor, jobId: string | null): Promise<{
  action: 'merged' | 'unchanged';
  contactId: string;
  conflicts: MergeConflict[];
  errors: string[];
}> {
  const contact = await requireContact(db, contactId);
  const before = { ...contact, phones: [...contact.phones], roles: [...contact.roles], complexKeys: [...contact.complexKeys] };
  const conflicts: MergeConflict[] = [];
  const changes: InteractionChange[] = [];
  const set: Partial<Contact> = {};
  const name = mergeField(contact.name, incoming.name, 'name');
  if (name.conflict) conflicts.push(name.conflict);
  if (name.changed) {
    set.name = name.value;
    changes.push({ field: 'name', from: contact.name, to: name.value });
  }
  const email = mergeField(contact.email, incoming.email, 'email');
  if (email.conflict) conflicts.push(email.conflict);
  if (email.changed) {
    set.email = email.value;
    changes.push({ field: 'email', from: contact.email, to: email.value });
  }
  const roles = unionRoles(contact.roles, incoming.roles);
  if (roles.added.length) {
    set.roles = roles.roles;
    changes.push({ field: 'roles', from: contact.roles.join(', '), to: roles.roles.join(', ') });
  }
  const phones = [...contact.phones];
  for (const phone of incoming.phones) {
    if (phones.includes(phone)) continue;
    const owners = await findContactsByPhones(db, [phone]);
    if (owners.some((owner) => owner.id !== contactId)) {
      conflicts.push({ field: 'phone', existing: 'another contact', incoming: phone });
      continue;
    }
    phones.push(phone);
  }
  if (phones.length !== contact.phones.length) {
    set.phones = phones;
    changes.push({ field: 'phones', from: contact.phones.join(', '), to: phones.join(', ') });
  }
  const callFlag = stickyFlag(contact.do_not_call, incoming.doNotCall);
  if (callFlag.changed) {
    set.do_not_call = true;
    changes.push({ field: 'do_not_call', from: 'false', to: 'true' });
  }
  const optFlag = stickyFlag(contact.opted_out, incoming.optedOut);
  if (optFlag.changed) {
    set.opted_out = true;
    changes.push({ field: 'opted_out', from: 'false', to: 'true' });
  }
  if (incoming.suspectedBroker && contact.suspected_broker !== 'VERIFY') {
    set.suspected_broker = 'VERIFY';
    changes.push({ field: 'suspected_broker', from: '', to: 'VERIFY' });
  }
  if (!contact.source && incoming.source) {
    set.source = incoming.source;
    changes.push({ field: 'source', from: '', to: incoming.source });
  }
  const journal = emptyJournal(jobId, contactId, false, before);
  if (Object.keys(set).length) {
    set.updatedAt = new Date().toISOString();
    set.updatedBy = actor.email;
    await db.collection(CONTACTS_COLLECTION).updateOne({ id: contactId }, { $set: set });
  }
  for (const complex of incoming.complexes) {
    const linked = await ensureComplexLink(db, contactId, complex, actor.id, jobId || '');
    if (linked?.created) {
      journal.createdComplexLinkIds.push(linked.link.id);
      changes.push({ field: 'complex', from: '', to: complex });
    }
  }
  for (const unit of incoming.units) {
    const key = unitKey(unit.complex, unit.tower, unit.flat);
    const existingUnit = await db.collection(UNITS_COLLECTION).findOne({ unitKey: key });
    const existingLink = existingUnit
      ? await db.collection(UNIT_LINKS_COLLECTION).findOne({ contactId, unitId: String((existingUnit as { id?: string }).id || '') })
      : null;
    if (!existingLink) {
      const linked = await linkContactToUnit(db, {
        contactId,
        complex: unit.complex,
        tower: unit.tower,
        flat: unit.flat,
        relation: unit.relation === 'tenant' ? 'tenant' : 'owner',
        agreementStart: unit.agreementStart,
        agreementEnd: unit.agreementEnd,
        actorId: actor.id,
        importJobId: jobId || '',
      });
      if (linked.createdUnit) journal.createdUnitIds.push(linked.unit.id);
      if (linked.createdLink) journal.createdUnitLinkIds.push(linked.link.id);
      const complexLink = await db.collection(COMPLEX_LINKS_COLLECTION).findOne({ contactId, complexKey: complexKey(unit.complex) });
      if (complexLink && String((complexLink as { importJobId?: string }).importJobId || '') === (jobId || '') && !journal.createdComplexLinkIds.includes(String((complexLink as { id?: string }).id))) {
        journal.createdComplexLinkIds.push(String((complexLink as { id?: string }).id));
      }
      changes.push({ field: 'flat', from: '', to: unit.flat });
      continue;
    }
    const link = existingLink as Record<string, unknown>;
    const linkSet: Record<string, string> = {};
    const start = mergeField(String(link.agreementStart || ''), unit.agreementStart, 'agreement_start');
    if (start.conflict) conflicts.push(start.conflict);
    if (start.changed) linkSet.agreementStart = start.value;
    const end = mergeField(String(link.agreementEnd || ''), unit.agreementEnd, 'agreement_end');
    if (end.conflict) conflicts.push(end.conflict);
    if (end.changed) linkSet.agreementEnd = end.value;
    const relation = mergeField(String(link.relation || ''), unit.relation, 'relation');
    if (relation.conflict) conflicts.push(relation.conflict);
    if (relation.changed) linkSet.relation = relation.value;
    if (Object.keys(linkSet).length) {
      await db.collection(UNIT_LINKS_COLLECTION).updateOne({ id: link.id }, { $set: { ...linkSet, updatedAt: new Date().toISOString() } });
      for (const [field, value] of Object.entries(linkSet)) {
        changes.push({ field, from: '', to: value });
      }
    }
  }
  let interactionId = '';
  if (changes.length || incoming.note) {
    const interaction = await insertInteraction(db, {
      contactId,
      kind: 'import',
      note: incoming.note || 'Merged from import',
      changes,
      actor,
      importJobId: jobId || '',
    });
    interactionId = interaction.id;
    journal.createdInteractionIds.push(interactionId);
  }
  if (journal.createdInteractionIds.length || journal.createdComplexLinkIds.length || journal.createdUnitIds.length || journal.createdUnitLinkIds.length || Object.keys(set).length) {
    await rememberJournal(db, journal);
  }
  await rebuildContactDerived(db, contactId);
  return {
    action: changes.length ? 'merged' : 'unchanged',
    contactId,
    conflicts,
    errors: [],
  };
}

function emptyJournal(jobId: string | null, contactId: string, created: boolean, before: Contact | null): Journal {
  return {
    id: randomUUID(),
    jobId: jobId || '',
    seq: Date.now(),
    contactId,
    created,
    before,
    createdComplexLinkIds: [],
    createdUnitIds: [],
    createdUnitLinkIds: [],
    createdInteractionIds: [],
  };
}

async function rememberJournal(db: Db, journal: Journal): Promise<void> {
  if (!journal.jobId) return;
  const existing = await db.collection(CONTACT_IMPORT_JOURNAL_COLLECTION).findOne({ jobId: journal.jobId, contactId: journal.contactId });
  if (!existing) {
    const count = await db.collection(CONTACT_IMPORT_JOURNAL_COLLECTION).countDocuments({ jobId: journal.jobId });
    journal.seq = count + 1;
    await db.collection(CONTACT_IMPORT_JOURNAL_COLLECTION).insertOne(journal);
    return;
  }
  const current = existing as unknown as Journal;
  await db.collection(CONTACT_IMPORT_JOURNAL_COLLECTION).updateOne({ id: current.id }, {
    $set: {
      createdComplexLinkIds: [...new Set([...(current.createdComplexLinkIds || []), ...journal.createdComplexLinkIds])],
      createdUnitIds: [...new Set([...(current.createdUnitIds || []), ...journal.createdUnitIds])],
      createdUnitLinkIds: [...new Set([...(current.createdUnitLinkIds || []), ...journal.createdUnitLinkIds])],
      createdInteractionIds: [...new Set([...(current.createdInteractionIds || []), ...journal.createdInteractionIds])],
    },
  });
}

export async function bulkUpsertContacts(db: Db, actor: ContactActor, records: Array<Record<string, string>>): Promise<{
  results: Array<{ index: number; action: string; contactId: string; conflicts: MergeConflict[]; errors: string[] }>;
}> {
  if (records.length > UPSERT_LIMIT) {
    throw new ContactValidationError(`Send at most ${UPSERT_LIMIT} contacts per request.`);
  }
  const results = [];
  for (let index = 0; index < records.length; index += 1) {
    const parsed = incomingFromRecord(records[index] || {});
    if (parsed.errors.length) {
      results.push({ index, action: 'skipped', contactId: '', conflicts: [], errors: parsed.errors });
      continue;
    }
    const applied = await applyIncoming(db, parsed.incoming, actor, null);
    results.push({ index, action: applied.action, contactId: applied.contactId, conflicts: applied.conflicts, errors: applied.errors });
  }
  return { results };
}
