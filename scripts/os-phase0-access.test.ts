/**
 * Phase 0 permission helper, assignment scope, audit immutability, and broker redaction.
 * Run: npx tsx scripts/os-phase0-access.test.ts
 */
import assert from 'node:assert/strict';
import * as auditApi from '../lib/ops/os/audit';
import { appendOpsAudit, listOpsAudit } from '../lib/ops/os/audit';
import { canSeeResalePrivate } from '../lib/ops/projects/access';
import { contactCapabilities } from '../lib/ops/permissions';
import { navHrefVisible } from '../lib/ops/os/nav';
import { canOps, OPS_PERMISSION_MATRIX, recordVisibleTo, scopeRecords } from '../lib/ops/os/permissions';
import { payloadLeaksBrokerSecrets, redactBrokerPayload } from '../lib/ops/os/redact';
import { isSoftDeleted, notDeletedFilter, softDeletePatch, stampCreate } from '../lib/ops/os/records';
import { createMemoryDb } from './lib/memory-db';

function actor(role: string, id = 'user-1') {
  return { id, email: `${role}@example.com`, role, status: 'active' as const };
}

function main() {
  const superAdmin = actor('super_admin');
  const admin = actor('admin');
  const opsExec = actor('ops_exec', 'exec-1');
  const sales = actor('sales_exec', 'sales-1');
  const interior = actor('interior', 'int-1');
  const broker = actor('broker', 'broker-1');
  const suspended = { ...opsExec, status: 'suspended' };

  for (const permission of Object.keys(OPS_PERMISSION_MATRIX) as Array<keyof typeof OPS_PERMISSION_MATRIX>) {
    assert.equal(canOps(superAdmin, permission), true, `super admin ${permission}`);
    assert.equal(canOps(suspended, permission), false, `suspended ${permission}`);
  }

  for (const permission of ['import', 'export', 'edit', 'delete', 'see_resale_private', 'see_owner_identity', 'manage_users'] as const) {
    assert.equal(canOps(admin, permission), false);
    assert.equal(canOps(opsExec, permission), false);
    assert.equal(canOps(sales, permission), false);
    assert.equal(canOps(broker, permission), false);
  }

  for (const person of [admin, opsExec, sales, interior]) {
    assert.equal(canOps(person, 'view'), true);
    assert.equal(canOps(person, 'remark'), true);
    assert.equal(canOps(person, 'fill_empty'), true);
    assert.equal(canOps(person, 'see_contact_fields'), true);
  }

  assert.equal(canOps(broker, 'view'), true);
  assert.equal(canOps(broker, 'remark'), false);
  assert.equal(canOps(broker, 'see_contact_fields'), false);
  assert.equal(canOps(broker, 'see_internal_brokerage'), false);
  assert.equal(canOps(broker, 'see_builder_commercials'), false);
  assert.equal(canOps(broker, 'see_private_client'), false);
  assert.equal(canOps(broker, 'see_asking_negotiation'), false);
  assert.equal(canOps(admin, 'see_resale_private'), false);
  assert.equal(canSeeResalePrivate(superAdmin as never), true);
  assert.equal(canSeeResalePrivate(admin as never), false);

  const teamContact = contactCapabilities(opsExec);
  assert.equal(teamContact.view, true);
  assert.equal(teamContact.fillEmpty, true);
  assert.equal(teamContact.exportData, false);
  assert.equal(teamContact.importData, false);
  assert.equal(teamContact.editExisting, false);
  assert.equal(teamContact.deleteData, false);
  assert.equal(contactCapabilities(broker).view, false);
  assert.equal(contactCapabilities({ role: 'super_admin', status: 'active' }).exportData, true);

  const owned = { id: 'c1', assignedTo: 'exec-1', name: 'Owner', phones: ['9811111111'] };
  const other = { id: 'c2', assignedTo: 'someone-else', name: 'Other' };
  assert.equal(recordVisibleTo(opsExec, owned, 'contact'), true);
  assert.equal(recordVisibleTo(opsExec, other, 'contact'), false);
  assert.equal(recordVisibleTo(admin, other, 'contact'), true);
  assert.equal(recordVisibleTo(broker, owned, 'contact'), false);
  assert.deepEqual(scopeRecords(opsExec, [owned, other], 'contact').map((row) => row.id), ['c1']);
  assert.equal(recordVisibleTo(broker, { assignedTo: 'broker-1', projectName: 'Tower' }, 'resale'), true);
  assert.equal(recordVisibleTo(broker, { assignedTo: '', projectName: 'Tower' }, 'project'), true);

  const leaked = {
    projectName: 'Oberoi Esquire',
    locality: 'Goregaon',
    bhk: 3,
    ownerName: 'Asha Shah',
    ownerPhone: '9811111111',
    flatNumber: '1202',
    unitNumber: '1202',
    floor: '12',
    negotiationNotes: 'will take 5.8 if we move this week',
    askingPriceCrore: 6.2,
    expectedBrokerage: '2%',
    pricePerSqft: 48000,
    clientName: 'Rahul Mehta',
    clientPhone: '9822222222',
    notes: 'call the owner on 9811111111 or owner@example.com',
    salesPhone: { value: '9800000000' },
  };
  assert.equal(payloadLeaksBrokerSecrets(leaked), true);
  const redacted = redactBrokerPayload(leaked);
  assert.equal(payloadLeaksBrokerSecrets(redacted), false);
  assert.equal(redacted.projectName, 'Oberoi Esquire');
  assert.equal(redacted.locality, 'Goregaon');
  assert.equal(redacted.bhk, 3);
  assert.equal('ownerPhone' in redacted, false);
  assert.equal('ownerName' in redacted, false);
  assert.equal('flatNumber' in redacted, false);
  assert.equal('unitNumber' in redacted, false);
  assert.equal('negotiationNotes' in redacted, false);
  assert.equal('expectedBrokerage' in redacted, false);
  assert.equal('pricePerSqft' in redacted, false);
  assert.equal('clientPhone' in redacted, false);
  assert.equal('clientName' in redacted, false);
  assert.equal(redacted.notes?.includes('9811111111'), false);
  assert.equal(redacted.notes?.includes('owner@example.com'), false);
  assert.equal(redacted.notes?.includes('[redacted]'), true);

  const stamped = stampCreate({ id: 'exec-1' }, new Date('2026-11-03T00:00:00.000Z'));
  assert.equal(stamped.createdBy, 'exec-1');
  assert.equal(stamped.deletedAt, null);
  const removed = softDeletePatch({ id: 'exec-1' }, new Date('2026-11-03T01:00:00.000Z'));
  assert.equal(isSoftDeleted({ ...stamped, ...removed }), true);
  assert.deepEqual(notDeletedFilter().$or, [{ deletedAt: null }, { deletedAt: { $exists: false } }]);

  assert.equal('updateOpsAudit' in auditApi, false);
  assert.equal('deleteOpsAudit' in auditApi, false);

  assert.equal(navHrefVisible('super_admin', '/ops/users'), true);
  assert.equal(navHrefVisible('admin', '/ops/users'), false);
  assert.equal(navHrefVisible('ops_exec', '/ops/contacts'), true);
  assert.equal(navHrefVisible('ops_exec', '/ops/revenue'), false);
  assert.equal(navHrefVisible('broker', '/ops/contacts'), false);
  assert.equal(navHrefVisible('broker', '/ops/broker-portal'), true);
  assert.equal(navHrefVisible('admin', '/ops/contacts'), true);
  assert.equal(navHrefVisible('interior', '/ops/interior'), true);
}

async function auditRoundTrip() {
  const db = createMemoryDb();
  const first = await appendOpsAudit(db as never, {
    actorId: 'super-1',
    actorEmail: 'arun@example.com',
    action: 'user_created',
    entity: 'admin',
    entityId: 'user-9',
    before: null,
    after: { role: 'ops_exec' },
    at: '2026-11-03T00:00:00.000Z',
  });
  await appendOpsAudit(db as never, {
    actorId: 'super-1',
    actorEmail: 'arun@example.com',
    action: 'user_created',
    entity: 'admin',
    entityId: 'user-9',
    before: { role: 'ops_exec' },
    after: { role: 'sales_exec' },
    at: '2026-11-03T02:00:00.000Z',
  });
  const rows = await listOpsAudit(db as never, { entityId: 'user-9' });
  assert.equal(rows.length, 2);
  const original = rows.find((row) => row.id === first.id);
  assert.ok(original);
  assert.equal(original?.after?.role, 'ops_exec');
  assert.equal(original?.before, null);
}

main();
auditRoundTrip().then(() => {
  console.log('os-phase0-access: ok');
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
