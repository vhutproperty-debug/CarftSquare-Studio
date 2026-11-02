/**
 * Developer/resale inventory parser, privacy, and API gate.
 * Run: npx tsx scripts/projects-inventory.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Db } from 'mongodb';
import { NextRequest } from 'next/server';
import { createMemoryDb } from './lib/memory-db';
import { overlapsPriceBand, parseBhks, parseCrores, parsePsf, slugify } from '../lib/ops/projects/format';
import { draftsFromLaunchSheets } from '../lib/ops/projects/parse-launch-sheet';
import { RESALE_PROJECT_PLACEHOLDERS } from '../lib/ops/projects/placeholders';
import { toPublicResaleUnit, unitResponseLeaksPrivate } from '../lib/ops/projects/redact';
import type { ResaleUnit } from '../lib/ops/projects/types';
import { parseResaleUnitWrite } from '../lib/ops/projects/validate';
import {
  getDeveloperProject,
  importDeveloperDraft,
  listResaleUnits,
  saveDeveloperProject,
  saveResaleUnit,
  seedResalePlaceholders,
} from '../lib/ops/projects/store';
import { readXlsxSheets } from '../lib/ops/projects/xlsx';
import { isOpsProjectUpsertPath, middleware } from '../middleware.js';

const SHEET = '/home/ubuntu/.cursor/projects/workspace/uploads/Andheri_Goregaon_Launches_7f04.xlsx';

function unit(overrides: Partial<ResaleUnit> = {}): ResaleUnit {
  return {
    id: '1',
    slug: 'oberoi-esquire-tower-a-unit-ab12cd34',
    projectSlug: 'oberoi-esquire',
    projectName: 'Oberoi Esquire',
    tower: 'A',
    unitNumber: '1202',
    bhk: 3,
    carpetSqft: 1400,
    floorBand: 'high',
    askingPriceCrore: 6.5,
    askingPriceLabel: '₹6.5 Cr',
    status: 'available',
    listingType: 'resale',
    owner: { name: 'Private Owner', phone: '9898989898', email: 'owner@example.com' },
    notes: 'Sea-facing',
    sourceLinks: [],
    lastUpdatedBy: 'admin@example.com',
    lastUpdatedAt: '2026-11-02T00:00:00.000Z',
    createdAt: '2026-11-02T00:00:00.000Z',
    updatedAt: '2026-11-02T00:00:00.000Z',
    ...overrides,
  };
}

function request(path: string, init?: { method?: string; headers?: Record<string, string> }) {
  return new NextRequest(new URL(path, 'https://craftsquare.co.in'), init);
}

async function main() {
  const sheets = readXlsxSheets(readFileSync(SHEET));
  assert.deepEqual(sheets.map((sheet) => sheet.name), ['Andheri West', 'Goregaon West']);
  const drafts = draftsFromLaunchSheets(sheets);
  assert.equal(drafts.length, 14);
  assert.equal(drafts.filter((draft) => draft.locality === 'Andheri West').length, 8);
  assert.equal(drafts.filter((draft) => draft.locality === 'Goregaon West').length, 6);
  const westpark = drafts.find((draft) => draft.name.startsWith('DLF The Westpark'));
  assert.ok(westpark);
  assert.equal(westpark.priceMinCrore, 4.69);
  assert.equal(westpark.priceMaxCrore, 6.32);
  assert.deepEqual(westpark.bhk, [3, 4]);
  assert.equal(westpark.carpetMinSqft, 1125);
  assert.equal(westpark.status, 'new_launch');
  const serenova = drafts.find((draft) => draft.name === 'Serenova');
  assert.equal(serenova?.maharera, 'PR1180002500850');
  assert.equal(serenova?.pricePerSqft, 46800);
  const linkbay = drafts.find((draft) => draft.name.startsWith('Adani Linkbay'));
  assert.equal(linkbay?.pricePerSqft, 39400);
  assert.equal(linkbay?.pricePerSqftMax, 43400);
  const kalpataru = drafts.find((draft) => draft.name.startsWith('Kalpataru Vian'));
  assert.deepEqual(kalpataru?.bhk, [3, 4, 4.5]);
  assert.equal(kalpataru?.offerNote, 'Offer: Pay 10% now, nothing till OC');
  assert.ok(kalpataru?.sourceLinks.some((link) => link.startsWith('https://kalpatarultd.com/vian/')));
  assert.equal(drafts.filter((draft) => draft.channelPartnerStatus === 'not_approached').length, 14);

  assert.deepEqual(parseBhks('2 & 3 BHK; 710–1,083 sq ft'), [2, 3]);
  assert.deepEqual(parseCrores('From ₹3.12 Cr; 3BHK ₹5.47–6.37 Cr'), { min: 3.12, max: 6.37 });
  assert.deepEqual(parsePsf('~₹32,000–33,500/sq ft'), { min: 32000, max: 33500 });
  assert.equal(overlapsPriceBand(4.69, 6.32, '5_8'), true);
  assert.equal(overlapsPriceBand(2.61, 2.9, 'under_3'), true);
  assert.equal(overlapsPriceBand(8.4, 8.4, 'above_8'), true);
  assert.equal(slugify('Oberoi Sky City'), 'oberoi-sky-city');
  assert.deepEqual(RESALE_PROJECT_PLACEHOLDERS.map((item) => slugify(item.name)), [
    'oberoi-esquire',
    'oberoi-exquisite',
    'oberoi-elysian',
    'oberoi-sky-city',
  ]);

  const hidden = toPublicResaleUnit(unit());
  assert.equal('unitNumber' in hidden, false);
  assert.equal('owner' in hidden, false);
  assert.equal(unitResponseLeaksPrivate(hidden), false);
  assert.equal(hidden.projectName, 'Oberoi Esquire');
  assert.throws(
    () => parseResaleUnitWrite({ recordType: 'unit', projectSlug: 'oberoi-esquire', slug: 'oberoi-esquire-1202', unitNumber: '1202', tower: 'A' }),
    /flat number/i,
  );

  assert.equal(isOpsProjectUpsertPath('/api/ops/projects/developer', 'POST'), true);
  assert.equal(isOpsProjectUpsertPath('/api/ops/projects/resale/', 'PATCH'), true);
  assert.equal(isOpsProjectUpsertPath('/api/ops/projects/developer', 'GET'), false);
  assert.equal(isOpsProjectUpsertPath('/api/ops/projects/developer/westpark', 'POST'), false);
  assert.equal(isOpsProjectUpsertPath('/api/ops/projects', 'POST'), false);

  const tokenPost = await middleware(request('/api/ops/projects/developer', {
    method: 'POST',
    headers: { authorization: 'Bearer test-token' },
  }));
  assert.notEqual(tokenPost.status, 401);
  assert.equal(tokenPost.headers.get('x-middleware-next'), '1');

  const openGet = await middleware(request('/api/ops/projects/developer'));
  assert.equal(openGet.status, 401);
  assert.equal((await openGet.json()).error, 'Admin authentication required.');

  const openDelete = await middleware(request('/api/ops/projects/resale/oberoi-esquire', { method: 'DELETE' }));
  assert.equal(openDelete.status, 401);

  const page = await middleware(request('/ops/projects/developer'));
  assert.notEqual(page.status, 401);
  assert.equal(page.headers.get('x-middleware-next'), '1');

  const db = createMemoryDb() as unknown as Db;
  const sample = drafts[0];
  assert.equal(await importDeveloperDraft(db, sample, 'import'), 'created');
  await saveDeveloperProject(db, {
    slug: sample.slug,
    name: sample.name,
    patch: { contacts: [{ name: 'Sales', role: 'Manager', phone: '9898989898', email: 'sales@example.com' }], notes: 'keep me', channelPartnerStatus: 'applied' },
  }, 'admin@example.com');
  assert.equal(await importDeveloperDraft(db, sample, 'import'), 'updated');
  const kept = await getDeveloperProject(db, sample.slug);
  assert.equal(kept?.notes, 'keep me');
  assert.equal(kept?.contacts[0]?.phone, '9898989898');
  assert.equal(kept?.channelPartnerStatus, 'applied');
  assert.equal(kept?.priceMinCrore, sample.priceMinCrore);

  const seeded = await seedResalePlaceholders(db, 'import');
  assert.equal(seeded.created, 4);
  const again = await seedResalePlaceholders(db, 'import');
  assert.equal(again.created, 0);
  assert.equal(again.existing, 4);
  assert.equal((await listResaleUnits(db)).length, 0);
  const createdUnit = await saveResaleUnit(db, {
    slug: 'oberoi-esquire-tower-a-unit-ab12cd34',
    projectSlug: 'oberoi-esquire',
    patch: { tower: 'A', unitNumber: '1202', bhk: 3, owner: { name: 'Private Owner', phone: '9898989898', email: 'owner@example.com' } },
  }, 'admin@example.com');
  assert.equal(createdUnit.unit.unitNumber, '1202');
  assert.equal(toPublicResaleUnit(createdUnit.unit).projectSlug, 'oberoi-esquire');
  assert.equal(unitResponseLeaksPrivate(toPublicResaleUnit(createdUnit.unit)), false);

  console.log('projects inventory tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
