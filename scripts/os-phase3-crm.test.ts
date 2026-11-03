/**
 * Phase 3 requirements, inbox, and broker-portal redaction.
 * Run: npx tsx scripts/os-phase3-crm.test.ts
 */
import assert from 'node:assert/strict';
import { buildInbox } from '../lib/ops/crm/inbox';
import { createRequirement, listRequirements } from '../lib/ops/crm/requirements-store';
import { createDeveloper, createTower, saveApartment } from '../lib/ops/inventory/store';
import { redactBrokerPayload, payloadLeaksBrokerSecrets } from '../lib/ops/os/redact';
import { createMemoryDb } from './lib/memory-db';

async function main() {
  const items = buildInbox({
    requirements: [{ id: 'r1', title: '3 BHK Andheri', at: '2026-11-03T02:00:00.000Z' }],
    demands: [{ id: 'd1', title: 'Demand enquiry', at: '2026-11-03T01:00:00.000Z' }],
    conversations: [{ id: 'w1', title: 'WhatsApp conversation', at: '2026-11-03T03:00:00.000Z' }],
  });
  assert.deepEqual(items.map((item) => item.sourceId), ['w1', 'r1', 'd1']);
  assert.equal(new Set(items.map((item) => item.source)).size, 3);

  const db = createMemoryDb();
  const saved = await createRequirement(db as never, {
    clientName: 'Rahul Mehta',
    phone: '9822222222',
    bhk: '3',
    localities: ['Andheri', 'Goregaon'],
    budgetMin: '70000',
    budgetMax: '90000',
    assignedTo: 'sales-1',
  }, 'sales-1');
  const listed = await listRequirements(db as never);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, saved.id);
  const redacted = redactBrokerPayload(saved);
  assert.equal(payloadLeaksBrokerSecrets(redacted), false);
  assert.equal('phone' in redacted, false);
  assert.equal('clientName' in redacted, false);
  assert.equal(redacted.bhk, '3');

  const developer = await createDeveloper(db as never, { name: 'Oberoi' }, 'exec-1');
  const tower = await createTower(db as never, { developerId: developer.id, projectName: 'Esquire', name: 'A' }, 'exec-1');
  const apartment = await saveApartment(db as never, {
    developerId: developer.id,
    towerId: tower.id,
    projectName: 'Esquire',
    towerName: 'A',
    flat: '1202',
    assignedTo: 'broker-1',
  }, 'exec-1');
  const portal = redactBrokerPayload({ apartments: [apartment.apartment], rentals: [] });
  assert.equal(payloadLeaksBrokerSecrets(portal), false);
  assert.equal(portal.apartments[0].projectName, 'Esquire');
  assert.equal('flat' in portal.apartments[0], false);

  console.log('os-phase3-crm: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
