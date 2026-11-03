import { NextResponse } from 'next/server';
import type { Db } from 'mongodb';
import { csvEscape } from '@/lib/ops/csv';
import type { ContactActor, ContactCapabilities } from '@/lib/ops/permissions';
import { manageDenied } from '@/lib/ops/contacts/auth';
import { canOps, recordVisibleTo, scopeRecords } from '@/lib/ops/os/permissions';
import { presentForActor } from '@/lib/ops/os/redact';
import type { CanonicalField } from '@/lib/ops/contacts/columns';
import { ContactAccessError, ContactValidationError } from '@/lib/ops/contacts/errors';
import {
  bulkUpsertContacts,
  commitImportJob,
  createImportJob,
  getImportReport,
  stageImportRows,
  undoImportJob,
} from '@/lib/ops/contacts/import-job';
import { recordsFromUpload, previewUpload } from '@/lib/ops/contacts/parse-file';
import type { ContactPatch } from '@/lib/ops/contacts/policy';
import {
  addNote,
  assignContact,
  contactView,
  createContact,
  deleteContact,
  listColdCallQueue,
  listComplexNames,
  listContacts,
  listDueCallbacks,
  listInteractions,
  listTasks,
  patchContact,
  recordCallTap,
  recordOutcome,
  requireContact,
} from '@/lib/ops/contacts/store';
import { CONTACTS_COLLECTION, IMPORT_COMMIT_LIMIT, IMPORT_STAGE_LIMIT } from '@/lib/ops/contacts/types';
import { asContact } from '@/lib/ops/contacts/store';

export type HandlerAuth = {
  actor: ContactActor;
  capabilities: ContactCapabilities;
};

export function contactError(error: unknown, fallback: string) {
  if (error instanceof ContactAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
  if (error instanceof ContactValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
  console.error('[ops-contacts]', error instanceof Error ? error.message : error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

async function respond(fallback: string, action: () => Promise<Response>) {
  try {
    return await action();
  } catch (error) {
    return contactError(error, fallback);
  }
}

function denied(auth: HandlerAuth, action?: 'import' | 'export' | 'edit' | 'delete') {
  if (!auth.capabilities.addInformation && action !== 'import' && action !== 'export') {
    return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });
  }
  if (action) return manageDenied(auth.capabilities, action);
  return null;
}

function contactsClosed(auth: HandlerAuth): Response | null {
  if (canOps(auth.actor, 'see_contact_fields')) return null;
  return NextResponse.json({ error: 'You do not have permission to view contacts.' }, { status: 403 });
}

export async function handleListContacts(db: Db, auth: HandlerAuth, url: URL) {
  return respond('Unable to load contacts.', async () => {
  const block = denied(auth) || contactsClosed(auth);
  if (block) return block;
  const limit = Number(url.searchParams.get('limit') || 50);
  const items = scopeRecords(auth.actor, await listContacts(db, {
    q: url.searchParams.get('q') || '',
    complex: url.searchParams.get('complex') || '',
    limit,
  }), 'contact');
  const complexes = await listComplexNames(db);
  return NextResponse.json(presentForActor(auth.actor, {
    items,
    complexes,
    canManage: auth.capabilities.editExisting,
  }));
  });
}

export async function handleGetContact(db: Db, auth: HandlerAuth, id: string) {
  return respond('Unable to load the contact.', async () => {
  const block = denied(auth) || contactsClosed(auth);
  if (block) return block;
  const contact = await requireContact(db, id);
  if (!recordVisibleTo(auth.actor, contact, 'contact')) {
    return NextResponse.json({ error: 'Contact not found.' }, { status: 404 });
  }
  const [view, interactions, tasks] = await Promise.all([
    contactView(db, contact),
    listInteractions(db, id),
    listTasks(db, id),
  ]);
  return NextResponse.json(presentForActor(auth.actor, {
    contact: view,
    interactions,
    tasks,
    canManage: auth.capabilities.editExisting,
  }));
  });
}

export async function handleCreateContact(db: Db, auth: HandlerAuth, patch: ContactPatch) {
  return respond('Unable to create the contact.', async () => {
  const block = denied(auth, 'edit');
  if (block) return block;
  const contact = await createContact(db, auth.actor, patch);
  return NextResponse.json({ contact }, { status: 201 });
  });
}

export async function handlePatchContact(db: Db, auth: HandlerAuth, id: string, patch: ContactPatch) {
  return respond('Unable to update the contact.', async () => {
  const block = denied(auth);
  if (block) return block;
  const result = await patchContact(db, auth.actor, auth.capabilities.editExisting, id, patch);
  return NextResponse.json({ contact: result.contact, changes: result.changes, canManage: auth.capabilities.editExisting });
  });
}

export async function handleDeleteContact(db: Db, auth: HandlerAuth, id: string) {
  return respond('Unable to delete the contact.', async () => {
  const block = denied(auth, 'delete');
  if (block) return block;
  await deleteContact(db, id);
  return NextResponse.json({ ok: true });
  });
}

export async function handleNote(db: Db, auth: HandlerAuth, id: string, note: string) {
  const block = denied(auth) || contactsClosed(auth);
  if (block) return block;
  if (!canOps(auth.actor, 'remark')) {
    return NextResponse.json({ error: 'You do not have permission to add a remark.' }, { status: 403 });
  }
  const contact = await requireContact(db, id);
  if (!recordVisibleTo(auth.actor, contact, 'contact')) {
    return NextResponse.json({ error: 'Contact not found.' }, { status: 404 });
  }
  const interaction = await addNote(db, auth.actor, id, note);
  return NextResponse.json({ interaction }, { status: 201 });
}

export async function handleOutcome(db: Db, auth: HandlerAuth, id: string, body: { outcome?: string; note?: string; callbackOn?: string }) {
  const block = denied(auth) || contactsClosed(auth);
  if (block) return block;
  if (!canOps(auth.actor, 'remark')) {
    return NextResponse.json({ error: 'You do not have permission to add a remark.' }, { status: 403 });
  }
  const result = await recordOutcome(db, auth.actor, id, {
    outcome: String(body.outcome || ''),
    note: body.note,
    callbackOn: body.callbackOn,
  });
  return NextResponse.json(result, { status: 201 });
}

export async function handleAssign(db: Db, auth: HandlerAuth, id: string, assigneeId: string) {
  const block = denied(auth) || contactsClosed(auth);
  if (block) return block;
  if (!canOps(auth.actor, 'assign')) {
    return NextResponse.json({ error: 'Only an admin can assign records.' }, { status: 403 });
  }
  const contact = await assignContact(db, auth.actor, id, assigneeId);
  return NextResponse.json({ contact });
}

export async function handleCallTap(db: Db, auth: HandlerAuth, id: string, phone: string) {
  const block = denied(auth) || contactsClosed(auth);
  if (block) return block;
  const interaction = await recordCallTap(db, auth.actor, id, phone);
  return NextResponse.json({ interaction }, { status: 201 });
}

export async function handleQueue(db: Db, auth: HandlerAuth, url: URL) {
  const block = denied(auth);
  if (block) return block;
  const complex = url.searchParams.get('complex') || '';
  const assignedTo = url.searchParams.get('assignedTo') || '';
  const closed = contactsClosed(auth);
  if (closed) return closed;
  const [items, callbacks, complexes] = await Promise.all([
    listColdCallQueue(db, { complex, assignedTo }),
    listDueCallbacks(db, { assignedTo }),
    listComplexNames(db),
  ]);
  const visibleItems = scopeRecords(auth.actor, items, 'contact');
  const visibleCallbacks = callbacks.filter((callback) => {
    if (!canOps(auth.actor, 'view')) return false;
    return recordVisibleTo(auth.actor, { assignedTo: callback.assigneeId, createdBy: callback.createdBy }, 'contact')
      || recordVisibleTo(auth.actor, callback, 'contact');
  });
  return NextResponse.json(presentForActor(auth.actor, {
    items: visibleItems,
    callbacks: visibleCallbacks,
    complexes,
    canManage: auth.capabilities.editExisting,
  }));
}

export async function handleExport(db: Db, auth: HandlerAuth) {
  const block = denied(auth, 'export');
  if (block) return block;
  const docs = await db.collection(CONTACTS_COLLECTION).find({}).sort({ name: 1, id: 1 }).limit(100000).toArray();
  const contacts = docs.map((doc) => asContact(doc as Record<string, unknown>));
  const ids = contacts.map((contact) => contact.id);
  const views = await Promise.all(contacts.map((contact) => contactView(db, contact)));
  void ids;
  const header = ['id', 'name', 'phones', 'email', 'roles', 'complexes', 'towers', 'flats', 'relations', 'agreement_start', 'agreement_end', 'do_not_call', 'opted_out', 'suspected_broker', 'source'];
  const lines = [header.join(',')];
  for (const contact of views) {
    lines.push([
      contact.id,
      contact.name,
      contact.phones.join('|'),
      contact.email,
      contact.roles.join('|'),
      contact.complexes.map((item) => item.complex).join('|'),
      contact.units.map((unit) => unit.tower).join('|'),
      contact.units.map((unit) => unit.flat).join('|'),
      contact.units.map((unit) => unit.relation).join('|'),
      contact.units.map((unit) => unit.agreementStart).join('|'),
      contact.units.map((unit) => unit.agreementEnd).join('|'),
      contact.do_not_call,
      contact.opted_out,
      contact.suspected_broker || '',
      contact.source,
    ].map((value) => csvEscape(value)).join(','));
  }
  return new NextResponse(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="contacts.csv"',
      'Cache-Control': 'no-store',
    },
  });
}

export async function handleUpsert(db: Db, auth: HandlerAuth, records: Array<Record<string, string>>) {
  const block = denied(auth, 'import');
  if (block) return block;
  if (!Array.isArray(records)) return NextResponse.json({ error: 'contacts must be an array.' }, { status: 400 });
  const result = await bulkUpsertContacts(db, auth.actor, records);
  return NextResponse.json(result);
}

export async function handleCreateImportJob(db: Db, auth: HandlerAuth, filename: string) {
  const block = denied(auth, 'import');
  if (block) return block;
  const job = await createImportJob(db, auth.actor, filename);
  return NextResponse.json({ job }, { status: 201 });
}

export async function handleStageImport(db: Db, auth: HandlerAuth, jobId: string, startIndex: number, rows: Array<Record<string, string>>) {
  const block = denied(auth, 'import');
  if (block) return block;
  if (!Array.isArray(rows)) return NextResponse.json({ error: 'rows must be an array.' }, { status: 400 });
  const result = await stageImportRows(db, jobId, startIndex, rows);
  return NextResponse.json(result);
}

export async function handleImportReport(db: Db, auth: HandlerAuth, jobId: string) {
  const block = denied(auth, 'import');
  if (block) return block;
  return NextResponse.json(await getImportReport(db, jobId));
}

export async function handleCommitImport(db: Db, auth: HandlerAuth, jobId: string, limit?: number) {
  const block = denied(auth, 'import');
  if (block) return block;
  const result = await commitImportJob(db, auth.actor, jobId, limit || IMPORT_COMMIT_LIMIT);
  return NextResponse.json(result);
}

export async function handleUndoImport(db: Db, auth: HandlerAuth, jobId: string) {
  const block = denied(auth, 'import');
  if (block) return block;
  const job = await undoImportJob(db, jobId);
  return NextResponse.json({ job });
}

export async function handlePreviewUpload(auth: HandlerAuth, filename: string, bytes: Buffer) {
  const block = denied(auth, 'import');
  if (block) return block;
  return NextResponse.json(previewUpload(filename, bytes));
}

export async function handleStageUpload(
  db: Db,
  auth: HandlerAuth,
  jobId: string,
  filename: string,
  bytes: Buffer,
  mapping: Partial<Record<CanonicalField, string>>,
  extraPhones: string[],
) {
  const block = denied(auth, 'import');
  if (block) return block;
  const records = recordsFromUpload(filename, bytes, mapping, extraPhones);
  let accepted = 0;
  let invalid = 0;
  let folded = 0;
  for (let index = 0; index < records.length; index += IMPORT_STAGE_LIMIT) {
    const batch = await stageImportRows(db, jobId, index, records.slice(index, index + IMPORT_STAGE_LIMIT));
    accepted += batch.accepted;
    invalid += batch.invalid;
    folded += batch.folded;
  }
  const report = await getImportReport(db, jobId);
  return NextResponse.json({ accepted, invalid, folded, report });
}
