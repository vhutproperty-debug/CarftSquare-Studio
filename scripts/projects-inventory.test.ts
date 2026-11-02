/**
 * Developer/resale inventory parser, privacy, and API gate.
 * Run: npx tsx scripts/projects-inventory.test.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Db } from 'mongodb';
import { NextRequest } from 'next/server';
import { createMemoryDb } from './lib/memory-db';
import { overlapsPriceBand, parseBhks, parseCrores, parsePsf, slugify } from '../lib/ops/projects/format';
import { draftsFromLaunchSheets } from '../lib/ops/projects/parse-launch-sheet';
import { classifySalesField, SALES_CONTACT_SEED, sameProjectName } from '../lib/ops/projects/sales-contacts';
import { RESALE_PROJECT_PLACEHOLDERS } from '../lib/ops/projects/placeholders';
import { parseDashboardHtml } from '../lib/ops/projects/parse-resale-dashboards';
import { elysianConfig } from '../lib/ops/projects/resale-identity';
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
    owner: { name: 'Private Owner', phone: 'PHONE-TOKEN', email: 'owner@example.com', whatsapp: 'WA-TOKEN' },
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
  assert.equal(isOpsProjectUpsertPath('/api/ops/projects/resale/import', 'POST'), false);
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
    patch: { contacts: [{ name: 'Sales', role: 'Manager', phone: 'PHONE-TOKEN', email: 'sales@example.com' }], notes: 'keep me', channelPartnerStatus: 'applied' },
  }, 'admin@example.com');
  assert.equal(await importDeveloperDraft(db, sample, 'import'), 'updated');
  const kept = await getDeveloperProject(db, sample.slug);
  assert.equal(kept?.notes, 'keep me');
  assert.equal(kept?.contacts[0]?.phone, 'PHONE-TOKEN');
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
    patch: { tower: 'A', unitNumber: '1202', bhk: 3, owner: { name: 'Private Owner', phone: 'PHONE-TOKEN', email: 'owner@example.com', whatsapp: 'WA-TOKEN' } },
  }, 'admin@example.com');
  assert.equal(createdUnit.unit.unitNumber, '1202');
  assert.equal(toPublicResaleUnit(createdUnit.unit).projectSlug, 'oberoi-esquire');
  assert.equal(unitResponseLeaksPrivate(toPublicResaleUnit(createdUnit.unit)), false);

  const skyHtml = '<html><script>const inventory = [{ unit: "D-1208", tower: "D", floor: 12, price: 5.5, tag: "inclusive", tagLabel: "All Inclusive" }];</script>';
  const sky = parseDashboardHtml(skyHtml, 'Oberoi_SkyCity_Inventory.html');
  assert.equal(sky.project.slug, 'oberoi-sky-city');
  assert.equal(sky.project.locality, 'Borivali East');
  assert.equal(sky.units.length, 1);
  assert.equal(sky.units[0].status, 'for_sale');
  assert.equal(sky.units[0].askingPriceCrore, 5.5);
  assert.equal(sky.units[0].offerTag, 'All Inclusive');
  assert.equal(sky.units[0].floorBand, 'Mid-low (9–16)');
  assert.equal(sky.units[0].slug.includes('1208'), false);
  assert.doesNotMatch(sky.project.notes, /\d{10}/);

  assert.deepEqual(elysianConfig('A', '06'), { bhk: 4, configLabel: '4BHK Signature' });
  assert.deepEqual(elysianConfig('A', '02'), { bhk: 3, configLabel: '3BHK Palatial' });
  assert.deepEqual(elysianConfig('B', '05'), { bhk: 4, configLabel: '4BHK Elite' });

  const elysian = parseDashboardHtml(`<script>const DATA = ${JSON.stringify({
    as_of: '01-01-2026',
    totals: { master: 2, '3bhk': 1, '4bhk': 1, for_sale_3bhk: 1, for_sale_4bhk: 0, for_rent: 0, buyers: 0, followups: 1, contacted: 1 },
    contact_status: { REPLIED: 1, 'NOT CONTACTED': 1 },
    tower_cfg: { 'A|3 BHK': 1 },
    followups: [{
      unit: 'B-1406', tower: 'B', cfg: '4 BHK', detail: '4 BHK Elite', owner: 'Example Owner',
      phone: 'PHONE-TOKEN', wa: 'WA-TOKEN', avail: 'FOR SALE', intent: 'SELL', status: 'REPLIED',
      next: 'Call back about B-1406', priority: 'HIGH', notes: '',
    }],
    availability: [],
    campaign_4bhk: [],
    series06: [],
    series05: [{ unit: 'A-4305', tower: 'A', cfg: '3 BHK', detail: '3 BHK Palatial', status: 'NOT CONTACTED', asking: 'Rs 12.50 Cr' }],
    wrong_outreach: [],
  })};</script>`, 'Oberoi_Elysian_Dashboard.html');
  assert.equal(elysian.project.locality, 'Goregaon East');
  assert.match(elysian.project.notes, /Tower A 01\/06 = 4BHK Signature/);
  assert.match(elysian.project.notes, /Contact status/);
  assert.doesNotMatch(elysian.project.notes, /Example Owner|PHONE-TOKEN|B-1406/);
  const elite = elysian.units.find((item) => item.unitNumber === 'B-1406');
  assert.ok(elite);
  assert.equal(elite.status, 'for_sale');
  assert.equal(elite.configLabel, '4 BHK Elite');
  assert.equal(elite.priority, 'HIGH');
  assert.equal(elite.followUps.length, 1);
  assert.equal(elite.slug.includes('1406'), false);
  const hiddenElite = toPublicResaleUnit({
    ...createdUnit.unit,
    ...elite,
    id: 'x',
    projectName: 'Oberoi Elysian',
    sourceLinks: [],
    lastUpdatedBy: 'import',
    lastUpdatedAt: '',
    createdAt: '',
    updatedAt: '',
  });
  assert.equal('unitNumber' in hiddenElite, false);
  assert.equal('owner' in hiddenElite, false);
  assert.equal(hiddenElite.floorBand.length > 0, true);
  assert.equal(hiddenElite.nextAction.includes('1406'), false);
  assert.equal(unitResponseLeaksPrivate(hiddenElite), false);

  const park = parseDashboardHtml(`<script>const DATA = ${JSON.stringify({
    as_of: '02-01-2026',
    totals: { live: 1, sale: 1, rent: 0, diary: 1 },
    live: [{ unit: 'D-1302', bhk: '2 BHK', owner: 'Example Owner', phone: 'PHONE-TOKEN', wa: 'WA-TOKEN', status: 'RENT', config: '2 BHK · 497 carpet', ask: 'Available for rent now' }],
    diary: [{ when: '06 Jan 2026', unit: 'D-1302', owner: 'Example Owner', why: 'Confirm the visit', phone: 'PHONE-TOKEN', wa: 'WA-TOKEN' }],
  })};</script>`, '34Park_Dashboard.html');
  assert.equal(park.project.name, '34 Park');
  assert.equal(park.project.locality, 'Goregaon');
  assert.equal(park.units.length, 1);
  assert.equal(park.units[0].bhk, 2);
  assert.equal(park.units[0].carpetSqft, 497);
  assert.equal(park.units[0].status, 'for_rent');
  assert.equal(park.units[0].followUps.length, 1);
  assert.match(park.project.notes, /Diary items 1/);
  assert.doesNotMatch(park.project.notes, /PHONE-TOKEN|Example Owner|1302/);

  const uploadDir = '/home/ubuntu/.cursor/projects/workspace/uploads';
  if (existsSync(uploadDir)) {
    const htmlFiles = readdirSync(uploadDir).filter((name) => name.endsWith('.html'));
    assert.ok(htmlFiles.length >= 3);
    for (const file of htmlFiles) {
      const bundle = parseDashboardHtml(readFileSync(join(uploadDir, file), 'utf8'), file);
      assert.doesNotMatch(bundle.project.notes, /\d{10}/);
      bundle.units.forEach((item) => {
        const digits = item.unitNumber.replace(/\D/g, '');
        if (digits.length >= 3 && item.slug.split('-').includes(digits)) {
          throw new Error('A unit link contains the flat number.');
        }
        if (item.owner.phone && bundle.project.notes.includes(item.owner.phone)) {
          throw new Error('Project notes include an owner phone.');
        }
        if (item.owner.whatsapp && bundle.project.notes.includes(item.owner.whatsapp)) {
          throw new Error('Project notes include a WhatsApp number.');
        }
      });
    }
  }

  assert.equal(SALES_CONTACT_SEED.length, 14);
  assert.equal(sameProjectName('Kalpataru Vian (regd. Kalpataru Hrushikesh)', 'Kalpataru Vian'), true);
  const kolte = classifySalesField('sales@koltepatil.com');
  assert.equal(kolte.verification, 'unverified');
  assert.equal(kolte.value, 'sales@koltepatil.com');
  const missing = classifySalesField('not found');
  assert.equal(missing.value, '');
  assert.match(missing.note, /Unverified/);
  const general = classifySalesField('not found (general: cs@rustomjee.com; nri@rustomjee.com)');
  assert.equal(general.verification, 'unverified');
  assert.match(general.value, /cs@rustomjee.com/);
  assert.match(general.note, /general inbox/);
  const axiom = SALES_CONTACT_SEED.find((row) => row.project === 'Axiom Rudra');
  assert.equal(classifySalesField(axiom?.sales_email || '').value, '');
  assert.equal(classifySalesField(axiom?.source_url || '').value, '');

  console.log('projects inventory tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
