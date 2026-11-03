/**
 * Phase 2 canonical inventory. Does not merge or delete resale units.
 * Run: npx tsx scripts/os-phase2-inventory.test.ts
 */
import assert from 'node:assert/strict';
import { attachCandidateUnits, canonicalKey } from '../lib/ops/inventory/identity';
import {
  APARTMENTS_COLLECTION,
  createDeveloper,
  createRental,
  createTower,
  listApartments,
  saveApartment,
  softDeleteInventory,
} from '../lib/ops/inventory/store';
import { redactBrokerPayload } from '../lib/ops/os/redact';
import { createMemoryDb } from './lib/memory-db';

async function main() {
  assert.equal(canonicalKey(' Oberoi Esquire ', 'A', '1202'), canonicalKey('oberoi esquire', 'a', '1202'));
  assert.deepEqual(attachCandidateUnits(['u1'], ['u1', 'u2']), ['u1', 'u2']);

  const db = createMemoryDb();
  const developer = await createDeveloper(db as never, { name: 'Oberoi', locality: 'Goregaon' }, 'exec-1');
  const tower = await createTower(db as never, { developerId: developer.id, projectName: 'Oberoi Esquire', name: 'A' }, 'exec-1');
  const first = await saveApartment(db as never, {
    developerId: developer.id,
    towerId: tower.id,
    projectName: 'Oberoi Esquire',
    towerName: 'A',
    flat: '1202',
    candidateUnitIds: ['unit-a'],
  }, 'exec-1');
  const second = await saveApartment(db as never, {
    developerId: developer.id,
    towerId: tower.id,
    projectName: 'oberoi esquire',
    towerName: 'a',
    flat: '1202',
    candidateUnitIds: ['unit-b'],
  }, 'exec-1');
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.apartment.id, first.apartment.id);
  assert.deepEqual(second.apartment.candidateUnitIds, ['unit-a', 'unit-b']);
  assert.equal(await db.collection(APARTMENTS_COLLECTION).countDocuments(), 1);
  assert.equal(await db.collection('ops_resale_units').countDocuments(), 0);

  const rental = await createRental(db as never, { apartmentId: first.apartment.id, rent: '90000', deposit: '300000' }, 'exec-1');
  assert.equal(rental.status, 'available');
  const hidden = await softDeleteInventory(db as never, APARTMENTS_COLLECTION, first.apartment.id, 'super-1');
  assert.equal(hidden, true);
  const visible = await listApartments(db as never);
  assert.equal(visible.length, 0);
  assert.equal(await db.collection(APARTMENTS_COLLECTION).countDocuments(), 1);

  const redacted = redactBrokerPayload(second.apartment);
  assert.equal('flat' in redacted, false);
  assert.equal(redacted.projectName, 'Oberoi Esquire');

  console.log('os-phase2-inventory: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
