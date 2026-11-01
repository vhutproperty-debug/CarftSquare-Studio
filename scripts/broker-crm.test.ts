/**
 * Broker CRM: import upsert, priority order, do-not-contact, and WhatsApp waves.
 * Run: yarn test:broker-crm
 *
 * Uses invented phone numbers only.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Db } from 'mongodb';
import { createMemoryDb } from './lib/memory-db';
import { buildBrokerCrmRecord } from '../lib/ops/broker-crm/record';
import { planBrokerCrmImport } from '../lib/ops/broker-crm/plan';
import { parseBrokerCrmFile } from '../lib/ops/broker-crm/parse';
import { applyBrokerCrmPatch } from '../lib/ops/broker-crm/patch';
import { applyBrokerCrmQuery } from '../lib/ops/broker-crm/query';
import { isPriorityBroker } from '../lib/ops/broker-crm/priority';
import { outreachCsvFor } from '../lib/ops/broker-crm/privacy';
import { brokerRecordsToMarketRequirements } from '../lib/ops/broker-crm/market';
import {
  approveBrokerCrmWave,
  importBrokerCrmRows,
  loadBrokerCrmRecords,
  markBrokerContacted,
  updateBrokerCrm,
} from '../lib/ops/broker-crm/store';
import type { BrokerImportRow, OpsBrokerCrmRecord } from '../lib/ops/broker-crm/types';
import {
  buildWaveApproval,
  buildWaveMessageTemplate,
  buildWhatsAppPriorityQueue,
  renderWaveCsv,
  WAVE_SENDS_WHATSAPP,
} from '../lib/ops/broker-crm/waves';
import { supplyToFlat } from '../lib/ops/market/adapt';
import { buildMarketOverview } from '../lib/ops/market/match';
import type { OpsSupplyRecord } from '../lib/ops/supply/types';
import { BrokerCrmPrivacyError } from '../lib/ops/broker-crm/privacy';

const NOW = '2026-04-02T09:00:00.000Z';
const SECRET_NOTE = 'Flat B-1804 owner Mehul Shah rent 87500 brokerage 50/50';

function row(partial: Partial<BrokerImportRow> & Pick<BrokerImportRow, 'phoneRaw'>): BrokerImportRow {
  return { name: '', groupsRaw: '', adminRaw: '', ...partial };
}

function broker(partial: {
  id: string;
  phone: string;
  name: string;
  groups: string[];
  admin?: boolean;
  status?: OpsBrokerCrmRecord['status'];
  notes?: string;
}): OpsBrokerCrmRecord {
  return buildBrokerCrmRecord({
    ...partial,
    admin: Boolean(partial.admin),
    notes: partial.notes,
    status: partial.status,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function memoryDb(): Db {
  return createMemoryDb() as unknown as Db;
}

async function testImportUpsert() {
  const db = memoryDb();
  const first = await importBrokerCrmRows(db, [
    row({ phoneRaw: '+91 91000 00021', name: 'First Name', groupsRaw: 'Agent Group Andheri', adminRaw: '' }),
    row({ phoneRaw: '9100000021', name: 'Later Name', groupsRaw: 'Goregaon East broker group;EKTA WORLD PROJECTS', adminRaw: 'yes' }),
    row({ phoneRaw: 'not-a-phone', name: 'Skip Me', groupsRaw: 'Agent Group Andheri', adminRaw: 'yes' }),
  ], NOW);

  assert.equal(first.created, 1);
  assert.equal(first.skipped, 1);
  assert.equal(first.dedupedInFile, 1);
  assert.equal(first.admins, 1);

  const [created] = await loadBrokerCrmRecords(db);
  assert.equal(created.phone, '9100000021');
  assert.equal(created.name, 'First Name');
  assert.equal(created.admin, true);
  assert.deepEqual(created.groups, ['Agent Group Andheri', 'Goregaon East broker group', 'EKTA WORLD PROJECTS']);
  assert.equal(created.groupCount, 3);
  assert.equal(created.derivedAreas.includes('Andheri'), true);
  assert.equal(created.derivedAreas.includes('Goregaon'), true);
  assert.equal(created.derivedProjects.includes('Ekta World'), true);
  assert.equal(created.status, 'new');

  const edited = await updateBrokerCrm(db, created.id, {
    name: 'Asha K.',
    status: 'contacted',
    notes: SECRET_NOTE,
    lastContactedAt: '2026-03-20',
    requirements: [{
      id: 'req-andheri-2',
      bhk: '2 BHK',
      budgetBandId: 'rent_60_80',
      area: 'Andheri',
      project: 'Ekta World',
      intent: 'rent',
      active: true,
    }],
  }, '2026-04-03T09:00:00.000Z');
  assert.ok(edited);
  assert.equal(edited.nameEdited, true);

  const second = await importBrokerCrmRows(db, [
    row({ phoneRaw: '+919100000021', name: 'Spreadsheet Name', groupsRaw: 'Oberoi Sky City', adminRaw: '' }),
  ], '2026-04-04T09:00:00.000Z');
  assert.equal(second.created, 0);
  assert.equal(second.updated, 1);

  const [again] = await loadBrokerCrmRecords(db);
  assert.equal(again.id, created.id);
  assert.equal(again.name, 'Asha K.');
  assert.equal(again.status, 'contacted');
  assert.equal(again.notes, SECRET_NOTE);
  assert.equal(again.lastContactedAt, '2026-03-20');
  assert.equal(again.requirements.length, 1);
  assert.deepEqual(again.groups, ['Oberoi Sky City']);
  assert.equal(again.admin, false);
  assert.equal((await loadBrokerCrmRecords(db)).length, 1);
}

function testPriorityOrder() {
  const records = [
    broker({ id: 'single', phone: '9100000031', name: 'Single', groups: ['One'] }),
    broker({ id: 'two', phone: '9100000032', name: 'Two', groups: ['One', 'Two'] }),
    broker({ id: 'admin', phone: '9100000033', name: 'Admin', groups: ['One'], admin: true }),
    broker({ id: 'eight', phone: '9100000034', name: 'Eight', groups: ['1', '2', '3', '4', '5', '6', '7', '8'] }),
  ];
  const listed = applyBrokerCrmQuery(records, { sort: 'priority', sortDir: 'desc', pageSize: 10 });
  assert.deepEqual(listed.items.map((item) => item.id), ['eight', 'two', 'admin', 'single']);
  assert.deepEqual(listed.items.map((item) => item.priority), [true, true, true, false]);
  assert.equal(isPriorityBroker(1, false), false);
  assert.equal(isPriorityBroker(2, false), true);
  assert.equal(isPriorityBroker(1, true), true);
}

function testDoNotContact() {
  const reachable = broker({ id: 'ok', phone: '9100000041', name: 'Reachable', groups: ['One', 'Two'] });
  const blocked = applyBrokerCrmPatch(
    broker({ id: 'dnc', phone: '9100000042', name: 'Blocked', groups: ['One', 'Two', 'Three'], notes: SECRET_NOTE }),
    {
      status: 'do-not-contact',
      requirements: [{
        id: 'req-blocked',
        bhk: '2 BHK',
        budgetBandId: 'rent_40_60',
        area: 'Malad',
        project: '',
        intent: 'rent',
      }],
    },
    NOW,
  );
  const withDemand = applyBrokerCrmPatch(reachable, {
    requirements: [{
      id: 'req-ok',
      bhk: '2 BHK',
      budgetBandId: 'rent_60_80',
      area: 'Andheri',
      project: 'Ekta World',
      intent: 'rent',
    }],
  }, NOW);

  const csv = outreachCsvFor([withDemand, blocked]);
  assert.equal(csv.includes('9100000041'), true);
  assert.equal(csv.includes('9100000042'), false);
  assert.equal(csv.includes('B-1804'), false);
  assert.equal(csv.includes('87500'), false);
  assert.equal(csv.includes('brokerage'), false);
  assert.equal(csv.includes(SECRET_NOTE), false);

  const requirements = brokerRecordsToMarketRequirements([withDemand, blocked, applyBrokerCrmPatch(reachable, { status: 'dormant' }, NOW)]);
  assert.equal(requirements.length, 1);
  assert.equal(requirements[0].source, 'broker');
  assert.equal(requirements[0].budgetLabel, '₹60–80k');
  const dumped = JSON.stringify(requirements);
  assert.equal(dumped.includes('B-1804'), false);
  assert.equal(dumped.includes('Mehul'), false);
  assert.equal(dumped.includes('87500'), false);
  assert.equal(dumped.includes('brokerage'), false);
  assert.equal(dumped.includes('9100000041'), false);
}

async function testDoNotContactStaysOutOfContactMark(dbReady?: Db) {
  const db = dbReady || memoryDb();
  await importBrokerCrmRows(db, [
    row({ phoneRaw: '9100000043', name: 'Quiet', groupsRaw: 'A;B', adminRaw: '' }),
  ], NOW);
  const [record] = await loadBrokerCrmRecords(db);
  await updateBrokerCrm(db, record.id, { status: 'do-not-contact' }, NOW);
  await assert.rejects(() => markBrokerContacted(db, record.id, NOW), /Do-not-contact/);
}

function testWaveGrouping() {
  const records = [
    broker({ id: 'c8', phone: '9100000051', name: 'Count Eight', groups: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] }),
    broker({ id: 'c6-admin', phone: '9100000052', name: 'Zara Admin', groups: ['a', 'b', 'c', 'd', 'e', 'f'], admin: true }),
    broker({ id: 'c6-z', phone: '9100000053', name: 'Zara Peer', groups: ['a', 'b', 'c', 'd', 'e', 'f'] }),
    broker({ id: 'c6-a', phone: '9100000054', name: 'Asha Peer', groups: ['a', 'b', 'c', 'd', 'e', 'f'] }),
    broker({ id: 'c4-admin', phone: '9100000055', name: 'Zara Four', groups: ['a', 'b', 'c', 'd'], admin: true }),
    broker({ id: 'c4', phone: '9100000056', name: 'Asha Four', groups: ['a', 'b', 'c', 'd'] }),
    broker({ id: 'c3-admin', phone: '9100000057', name: 'Zara Three', groups: ['a', 'b', 'c'], admin: true }),
    broker({ id: 'c3', phone: '9100000058', name: 'Asha Three', groups: ['a', 'b', 'c'] }),
    broker({ id: 'c2', phone: '9100000059', name: 'Two Groups', groups: ['a', 'b'] }),
    broker({ id: 'c2-dnc', phone: '9100000060', name: 'Two Hidden', groups: ['a', 'b'], status: 'do-not-contact' }),
    broker({ id: 'c5-dnc', phone: '9100000061', name: 'Five Hidden', groups: ['a', 'b', 'c', 'd', 'e'], status: 'do-not-contact' }),
    broker({ id: 'c1-admin', phone: '9100000062', name: 'Solo Admin', groups: ['a'], admin: true }),
  ];

  const queue = buildWhatsAppPriorityQueue(records);
  assert.deepEqual(queue.waves[1].map((row) => row.id), ['c8', 'c6-admin', 'c6-a', 'c6-z', 'c4-admin', 'c4']);
  assert.deepEqual(queue.waves[2].map((row) => row.id), ['c3-admin', 'c3']);
  assert.deepEqual(queue.waves[3].map((row) => row.id), ['c2']);
  assert.equal(queue.counts[1], 6);
  assert.equal(queue.counts[2], 2);
  assert.equal(queue.counts[3], 1);
  assert.equal(queue.excludedDoNotContact, 2);
  assert.equal(queue.waves[1].some((row) => row.phone === '9100000061'), false);
  assert.equal(queue.waves[3].some((row) => row.phone === '9100000060'), false);
  assert.equal([...queue.waves[1], ...queue.waves[2], ...queue.waves[3]].some((row) => row.id === 'c1-admin'), false);

  const csv = renderWaveCsv(queue.waves[1], {
    bhk: '2 BHK',
    floorBand: 'Mid floor 15-25',
    furnishing: 'Furnished',
    project: 'Ekta World',
  });
  assert.equal(csv.includes('9100000061'), false);
  assert.equal(csv.includes('Call for price'), true);
  assert.equal(csv.includes('87500'), false);
  assert.equal(csv.includes('B-1804'), false);
}

function testWaveTemplate() {
  const template = buildWaveMessageTemplate({
    bhk: '2 BHK rent 87500',
    floorBand: 'Mid floor 15-25',
    furnishing: 'Furnishing on request',
    project: 'Ekta World',
  });
  assert.deepEqual(template.lines, [
    '2 BHK',
    'Mid floor 15-25',
    'Furnishing on request',
    'Ekta World',
    'Call for price',
  ]);
  assert.equal(template.priceLine, 'Call for price');
  assert.equal(template.text.includes('87500'), false);
  assert.equal(template.text.includes('rent'), false);

  const poisoned = buildWaveMessageTemplate({
    bhk: '3 BHK',
    floorBand: 'Ground floor',
    furnishing: 'Unfurnished',
    project: 'Oberoi Sky City',
    ...({
      rent: '87500',
      unit: 'B-1804',
      ownerName: 'Mehul Shah',
      brokerage: '50/50',
    } as Record<string, string>),
  });
  const text = poisoned.text;
  assert.equal(text.includes('87500'), false);
  assert.equal(text.includes('B-1804'), false);
  assert.equal(text.includes('Mehul'), false);
  assert.equal(text.includes('brokerage'), false);
  assert.equal(text.includes('50/50'), false);
  assert.equal(text.endsWith('Call for price'), true);

  assert.throws(() => buildWaveMessageTemplate({ floorBand: '18' }), BrokerCrmPrivacyError);
  assert.throws(() => buildWaveMessageTemplate({ project: 'Tower B-1804' }), BrokerCrmPrivacyError);
  assert.throws(() => buildWaveMessageTemplate({ project: 'Owner Mehul' }), BrokerCrmPrivacyError);

  const approval = buildWaveApproval({
    id: 'apr-1',
    wave: 1,
    approvedAt: NOW,
    approvedById: 'owner',
    approvedByEmail: 'owner@example.com',
    recipientCount: 51,
    template: template.text,
  });
  assert.equal(approval.sent, false);
  assert.equal(WAVE_SENDS_WHATSAPP, false);
}

async function testWaveApprovalDoesNotSend() {
  const db = memoryDb();
  await importBrokerCrmRows(db, [
    row({ phoneRaw: '9100000071', name: 'Wave', groupsRaw: 'A;B;C;D', adminRaw: 'yes' }),
    row({ phoneRaw: '9100000072', name: 'Skip', groupsRaw: 'A;B;C;D;E', adminRaw: '' }),
  ], NOW);
  const [blocked] = (await loadBrokerCrmRecords(db)).filter((record) => record.phone === '9100000072');
  await updateBrokerCrm(db, blocked.id, { status: 'do-not-contact' }, NOW);
  const { approval } = await approveBrokerCrmWave(db, {
    wave: 1,
    approvedById: 'owner',
    approvedByEmail: 'owner@example.com',
    template: { bhk: '2 BHK', floorBand: 'Lower floor 1-7', furnishing: 'Furnished', project: 'Ekta World' },
    now: NOW,
  });
  assert.equal(approval.sent, false);
  assert.equal(approval.recipientCount, 1);
  assert.equal(approval.template?.includes('Call for price'), true);
  assert.equal(JSON.stringify(approval).includes('9100000071'), false);
}

function testFileParser() {
  const bytes = readFileSync(new URL('./fixtures/broker-crm-sample.xlsx', import.meta.url));
  const parsed = parseBrokerCrmFile('broker-crm-sample.xlsx', bytes);
  const plan = planBrokerCrmImport([], parsed, NOW);
  assert.equal(plan.stats.rows, 4);
  assert.equal(plan.stats.skipped, 1);
  assert.equal(plan.stats.dedupedInFile, 1);
  assert.equal(plan.stats.created, 2);
  const kept = plan.writes.find((record) => record.phone === '9100000001');
  assert.ok(kept);
  assert.equal(kept.name, 'Sample Asha');
  assert.equal(kept.admin, true);
  assert.equal(kept.groupCount, 3);
  assert.equal(kept.groups.includes('EKTA WORLD PROJECTS'), true);
}

function testMarketMatch() {
  const record = applyBrokerCrmPatch(
    broker({ id: 'demand', phone: '9100000081', name: 'Asha Kulkarni (sample)', groups: ['Agent Group Andheri', 'EKTA WORLD PROJECTS'] }),
    {
      status: 'active',
      requirements: [{
        id: 'req-match',
        bhk: '2 BHK',
        budgetBandId: 'rent_60_80',
        area: 'Andheri',
        project: 'Ekta World',
        intent: 'rent',
      }],
    },
    NOW,
  );
  const flat = supplyToFlat({
    id: 'flat-1',
    source: 'manual_inventory',
    priority: 'MEDIUM',
    status: 'AVAILABLE',
    readyForMatching: true,
    listingType: 'rent',
    configuration: '2 BHK',
    expectedRent: '70000',
    project: 'Ekta World',
    locality: 'Andheri',
    furnishedStatus: 'furnished',
    flatNumber: 'B-1804',
    ownerName: 'Mehul Shah',
    createdAt: NOW,
    updatedAt: NOW,
  } as OpsSupplyRecord);
  assert.ok(flat);
  const overview = buildMarketOverview([flat], brokerRecordsToMarketRequirements([record]));
  assert.equal(overview.matches.length, 1);
  assert.equal(overview.requirements[0].href, '/ops/broker-crm/demand');
  const requirementText = JSON.stringify(overview.requirements);
  assert.equal(requirementText.includes('B-1804'), false);
  assert.equal(requirementText.includes('Mehul'), false);
}

async function main() {
  await testImportUpsert();
  testPriorityOrder();
  testDoNotContact();
  await testDoNotContactStaysOutOfContactMark();
  testWaveGrouping();
  testWaveTemplate();
  await testWaveApprovalDoesNotSend();
  testFileParser();
  testMarketMatch();
  console.log('broker-crm tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
