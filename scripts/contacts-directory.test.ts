/**
 * Contacts directory: phone normalization, dedupe/merge, and access rules.
 * Run: npx tsx scripts/contacts-directory.test.ts
 */
import assert from 'node:assert/strict';
import type { Db } from 'mongodb';
import { NextRequest } from 'next/server';
import { contactCapabilities } from '../lib/ops/permissions';
import { authorizeContacts } from '../lib/ops/contacts/auth';
import { suggestMapping } from '../lib/ops/contacts/columns';
import { handleCallTap, handleDeleteContact, handleExport, handleGetContact, handleOutcome, handlePatchContact, handleStageImport, type HandlerAuth } from '../lib/ops/contacts/handlers';
import { bulkUpsertContacts, commitImportJob, createImportJob, getImportReport, stageImportRows, undoImportJob } from '../lib/ops/contacts/import-job';
import { mergeField } from '../lib/ops/contacts/merge';
import { previewUpload } from '../lib/ops/contacts/parse-file';
import { normalizeContactPhone, splitPhones } from '../lib/ops/contacts/phone';
import { computeQueueBand } from '../lib/ops/contacts/queue';
import {
  createContact,
  ensureContactIndexes,
  findContactsByPhones,
  listColdCallQueue,
  listInteractions,
} from '../lib/ops/contacts/store';
import { CONTACT_INDEX_SPECS } from '../lib/ops/contacts/types';
import { isOpsProjectUpsertPath, middleware } from '../middleware.js';
import { createMemoryDb } from './lib/memory-db';

function request(path: string, method = 'GET') {
  return new NextRequest(new URL(path, 'https://craftsquare.co.in'), { method });
}

function auth(role: string, via: 'session' | 'token' = 'session'): HandlerAuth {
  const actor = {
    id: `${role}-id`,
    email: `${role}@example.com`,
    name: role,
    role,
    via,
    status: 'active',
  };
  return { actor, capabilities: contactCapabilities(actor) };
}

async function main() {
  assert.equal(normalizeContactPhone('9876543210'), '+919876543210');
  assert.equal(normalizeContactPhone('+91 98765 43210'), '+919876543210');
  assert.equal(normalizeContactPhone('09876543210'), '+919876543210');
  assert.equal(normalizeContactPhone('919876543210'), '+919876543210');
  assert.equal(normalizeContactPhone('+65 9123 4567'), '+6591234567');
  assert.equal(normalizeContactPhone('12345'), null);
  assert.equal(normalizeContactPhone(''), null);
  assert.deepEqual(splitPhones('9876543210 / 9876543211'), ['+919876543210', '+919876543211']);

  const kept = mergeField('Asha', 'Asha Mehta', 'name');
  assert.equal(kept.value, 'Asha');
  assert.equal(kept.changed, false);
  assert.equal(kept.conflict?.incoming, 'Asha Mehta');
  const filled = mergeField('', 'asha@example.com', 'email');
  assert.equal(filled.changed, true);
  assert.equal(filled.value, 'asha@example.com');

  assert.equal(computeQueueBand({ ownerUnitCount: 2, nearestAgreementEnd: '9999-12-31', lastContactedAt: '2026-01-01' }), 0);
  assert.equal(computeQueueBand({ ownerUnitCount: 1, nearestAgreementEnd: '2026-11-10', lastContactedAt: '' }, '2026-11-02'), 1);
  assert.equal(computeQueueBand({ ownerUnitCount: 0, nearestAgreementEnd: '9999-12-31', lastContactedAt: '' }, '2026-11-02'), 2);
  assert.equal(computeQueueBand({ ownerUnitCount: 0, nearestAgreementEnd: '9999-12-31', lastContactedAt: '2026-11-01' }, '2026-11-02'), 3);

  const adminCaps = contactCapabilities({ role: 'admin', status: 'active' });
  const superCaps = contactCapabilities({ role: 'super_admin', status: 'active' });
  const teamCaps = contactCapabilities({ role: 'agent', status: 'active' });
  assert.equal(adminCaps.view, true);
  assert.equal(adminCaps.exportData, false);
  assert.equal(adminCaps.importData, false);
  assert.equal(adminCaps.editExisting, false);
  assert.equal(adminCaps.deleteData, false);
  assert.equal(adminCaps.fillEmpty, true);
  assert.equal(teamCaps.editExisting, false);
  assert.equal(superCaps.importData, true);
  assert.equal(superCaps.exportData, true);
  assert.equal(contactCapabilities({ role: 'token', via: 'token' }).importData, true);

  assert.equal(isOpsProjectUpsertPath('/api/ops/contacts/upsert', 'POST'), true);
  assert.equal(isOpsProjectUpsertPath('/api/ops/contacts/upsert', 'GET'), false);
  assert.equal(isOpsProjectUpsertPath('/api/ops/contacts/import/jobs', 'POST'), false);
  const tokenPost = await middleware(request('/api/ops/contacts/upsert', 'POST'));
  assert.notEqual(tokenPost.status, 401);
  const blockedExport = await middleware(request('/api/ops/contacts/export'));
  assert.equal(blockedExport.status, 401);

  process.env.OPS_API_TOKEN = 'contacts-test-token';
  const tokenAuth = await authorizeContacts(new Request('https://craftsquare.co.in/api/ops/contacts/upsert', {
    method: 'POST',
    headers: { authorization: 'Bearer contacts-test-token' },
  }), 'token_or_manage');
  assert.equal(tokenAuth.ok, true);
  if (tokenAuth.ok) assert.equal(tokenAuth.capabilities.importData, true);
  const badToken = await authorizeContacts(new Request('https://craftsquare.co.in/api/ops/contacts/upsert', {
    method: 'POST',
    headers: { authorization: 'Bearer wrong' },
  }), 'token_or_manage');
  assert.equal(badToken.ok, false);

  const preview = previewUpload('people.csv', Buffer.from('name,mobile,project\nAsha,9876543210,Elysian\n'));
  assert.equal(preview.suggested.mapping.name, 'name');
  assert.equal(preview.suggested.mapping.phone, 'mobile');
  assert.equal(preview.suggested.mapping.complex, 'project');
  assert.equal(preview.totalRows, 1);
  assert.equal(suggestMapping(['Owner phone', 'Flat no']).mapping.phone, 'Owner phone');
  assert.equal(suggestMapping(['Owner phone', 'Flat no']).mapping.flat, 'Flat no');
  assert.ok(CONTACT_INDEX_SPECS.some((spec) => spec.collection === 'contacts' && spec.options?.unique && spec.keys.phones === 1));

  const db = createMemoryDb() as unknown as Db;
  await ensureContactIndexes(db);
  const indexes = (db.collection('contacts') as unknown as { indexes: Array<{ keys: string[]; unique: boolean }> }).indexes;
  assert.ok(indexes.some((index) => index.unique && index.keys.includes('phones')));

  const superAuth = auth('super_admin');
  const adminAuth = auth('admin');
  const soon = new Date();
  soon.setUTCDate(soon.getUTCDate() + 10);
  const agreementEnd = soon.toISOString().slice(0, 10);
  const created = await createContact(db, superAuth.actor, {
    name: 'Asha Mehta',
    phones: ['9876543210'],
    roles: ['owner'],
    unit: { complex: 'Elysian', tower: 'A', flat: '1202', agreementEnd },
  });
  assert.equal(created.phones[0], '+919876543210');
  assert.equal(created.units[0].flat, '1202');
  assert.equal(created.phonesTel[0], 'tel:+919876543210');

  const visible = await handleGetContact(db, adminAuth, created.id);
  const visibleBody = await visible.json();
  assert.equal(visible.status, 200);
  assert.equal(visibleBody.contact.phones[0], '+919876543210');
  assert.equal(visibleBody.contact.units[0].flat, '1202');
  assert.equal(visibleBody.canManage, false);
  assert.equal(JSON.stringify(visibleBody).includes('••••'), false);

  const rename = await handlePatchContact(db, adminAuth, created.id, { name: 'Someone Else' });
  assert.equal(rename.status, 403);
  const email = await handlePatchContact(db, adminAuth, created.id, { email: 'asha@example.com' });
  assert.equal(email.status, 200);
  const emailAgain = await handlePatchContact(db, adminAuth, created.id, { email: 'other@example.com' });
  assert.equal(emailAgain.status, 403);
  const flags = await handlePatchContact(db, adminAuth, created.id, { do_not_call: true });
  assert.equal(flags.status, 403);

  const exported = await handleExport(db, adminAuth);
  assert.equal(exported.status, 403);
  const stagedDenied = await handleStageImport(db, adminAuth, 'missing', 0, [{ phone: '9876543210' }]);
  assert.equal(stagedDenied.status, 403);
  const superExport = await handleExport(db, superAuth);
  assert.equal(superExport.status, 200);
  const csv = await superExport.text();
  assert.match(csv, /\+919876543210/);
  assert.match(csv, /1202/);

  const superRename = await handlePatchContact(db, superAuth, created.id, { name: 'Asha M.' });
  assert.equal(superRename.status, 200);
  const renamed = await superRename.json();
  assert.equal(renamed.contact.name, 'Asha M.');

  const tap = await handleCallTap(db, adminAuth, created.id, '+919876543210');
  assert.equal(tap.status, 201);
  const interactions = await listInteractions(db, created.id);
  assert.ok(interactions.some((item) => item.kind === 'call' && item.actorId === adminAuth.actor.id && item.changes.some((change) => change.to === '+919876543210')));

  const callback = await handleOutcome(db, adminAuth, created.id, { outcome: 'callback', callbackOn: '2026-11-20', note: 'Call after lunch' });
  assert.equal(callback.status, 201);
  const callbackBody = await callback.json();
  assert.equal(callbackBody.task.type, 'callback');
  assert.equal(callbackBody.task.dueAt, '2026-11-20');
  assert.equal(callbackBody.interaction.kind, 'outcome');

  const verify = await handlePatchContact(db, superAuth, created.id, { suspected_broker: 'VERIFY' });
  assert.equal(verify.status, 200);
  const blockedDelete = await handleDeleteContact(db, superAuth, created.id);
  assert.equal(blockedDelete.status, 403);
  const teamDelete = await handleDeleteContact(db, adminAuth, created.id);
  assert.equal(teamDelete.status, 403);

  const job = await createImportJob(db, superAuth.actor, 'owners.csv');
  await stageImportRows(db, job.id, 0, [
    { name: 'Ravi Shah', phone: '9000000001', role: 'owner', complex: 'Esquire', tower: 'A', flat: '501' },
    { name: 'Ravi S', phone: '90000 00001', role: 'owner', complex: 'Esquire', tower: 'B', flat: '802', email: 'ravi@example.com' },
    { name: 'Leena', phone: '9000000002', complex: 'Sky City' },
  ]);
  const report = await getImportReport(db, job.id);
  assert.equal(report.job.counts.folded, 1);
  assert.ok(report.conflicts.some((row) => row.conflicts.some((conflict) => conflict.field === 'name')));
  assert.equal(report.remaining, 2);
  await commitImportJob(db, superAuth.actor, job.id);
  const ravi = (await findContactsByPhones(db, ['+919000000001']))[0];
  assert.ok(ravi);
  assert.equal(ravi.name, 'Ravi Shah');
  assert.equal(ravi.email, 'ravi@example.com');
  const raviView = await handleGetContact(db, adminAuth, ravi.id);
  const raviBody = await raviView.json();
  assert.equal(raviBody.contact.units.length, 2);
  assert.equal(raviBody.contact.queueBand, 0);
  const leena = (await findContactsByPhones(db, ['+919000000002']))[0];
  const leenaView = await handleGetContact(db, teamCaps.view ? auth('agent') : adminAuth, leena.id);
  const leenaBody = await leenaView.json();
  assert.equal(leenaBody.contact.units.length, 0);
  assert.equal(leenaBody.contact.complexes[0].complex, 'Sky City');
  assert.equal(leenaBody.contact.phones[0], '+919000000002');

  const queue = await listColdCallQueue(db);
  const queueIds = queue.map((item) => item.id);
  assert.equal(queueIds[0], ravi.id);
  assert.ok(queueIds.indexOf(created.id) > 0);
  assert.ok(queueIds.indexOf(leena.id) > queueIds.indexOf(created.id));

  const upsert = await bulkUpsertContacts(db, superAuth.actor, [
    { name: 'New Person', phone: '9000000002', email: 'leena@example.com' },
  ]);
  assert.equal(upsert.results[0].action, 'merged');
  assert.ok(upsert.results[0].conflicts.some((conflict) => conflict.field === 'name'));
  const leenaAfter = (await findContactsByPhones(db, ['+919000000002']))[0];
  assert.equal(leenaAfter.name, 'Leena');
  assert.equal(leenaAfter.email, 'leena@example.com');

  await undoImportJob(db, job.id);
  assert.equal((await findContactsByPhones(db, ['+919000000001'])).length, 0);
  assert.equal((await findContactsByPhones(db, ['+919000000002'])).length, 0);
  const ashaStill = await findContactsByPhones(db, ['+919876543210']);
  assert.equal(ashaStill.length, 1);
  assert.equal(ashaStill[0].email, 'asha@example.com');

  console.log('contacts directory tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
