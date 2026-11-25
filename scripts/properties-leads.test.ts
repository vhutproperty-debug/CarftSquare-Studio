/**
 * CraftSquare Properties lead form: validation, consent record, rate-limit helpers, ops adapter.
 * Run: npx tsx scripts/properties-leads.test.ts
 */
import assert from 'node:assert/strict';
import type { Db } from 'mongodb';
import { createMemoryDb } from './lib/memory-db';
import { propertiesLeadSubmitSchema } from '../lib/properties/schemas';
import {
  PROPERTIES_CONSENT_TEXT,
  PROPERTIES_CONSENT_VERSION,
  PROPERTIES_LEADS_COLLECTION,
} from '../lib/properties/constants';
import {
  countRecentPropertiesLeadsByIp,
  createPropertiesLead,
  findRecentPropertiesLeadByMobile,
} from '../lib/properties/store';
import { captureUtmFromSearch } from '../lib/properties/utm';
import { propertiesAdapter } from '../lib/ops/leads/adapters/properties';
import { LEAD_ADAPTER_BY_SOURCE } from '../lib/ops/leads/adapters/index';
import { OPS_LEAD_SOURCES, OPS_LEAD_SOURCE_LABELS } from '../lib/ops/leads/types';

async function main() {
  const valid = {
    name: 'Test Person',
    mobile: '9876543210',
    intent: 'buy',
    consent: true,
    consentVersion: PROPERTIES_CONSENT_VERSION,
  };
  assert.equal(propertiesLeadSubmitSchema.safeParse(valid).success, true);
  assert.equal(propertiesLeadSubmitSchema.safeParse({ ...valid, consent: false }).success, false, 'consent must be ticked');
  assert.equal(propertiesLeadSubmitSchema.safeParse({ ...valid, consent: undefined }).success, false, 'consent required');
  assert.equal(propertiesLeadSubmitSchema.safeParse({ ...valid, intent: 'lease' }).success, false, 'unknown intent');
  assert.equal(propertiesLeadSubmitSchema.safeParse({ ...valid, email: 'not-an-email' }).success, false);
  assert.equal(propertiesLeadSubmitSchema.safeParse({ ...valid, email: '' }).success, true, 'email optional');
  assert.equal(propertiesLeadSubmitSchema.safeParse({ ...valid, name: '' }).success, false);
  assert.equal(propertiesLeadSubmitSchema.safeParse({ ...valid, consentVersion: 'old' }).success, false);

  assert.deepEqual(captureUtmFromSearch('?utm_source=fb&utm_campaign=p1&x=1'), { utmSource: 'fb', utmCampaign: 'p1' });

  const mem = createMemoryDb() as unknown as Record<string, unknown>;
  const db = {
    ...mem,
    collection: (mem.collection as (n: string) => unknown).bind(mem),
    listCollections: () => ({ toArray: async () => [{ name: PROPERTIES_LEADS_COLLECTION }] }),
  } as unknown as Db;

  const lead = await createPropertiesLead(db, {
    name: ' Test Person ',
    mobile: '9876543210',
    intent: 'rent_out',
    area: 'Goregaon West',
    budget: '60k',
    utm: { utmSource: 'fb' },
    ip: '1.2.3.4',
    userAgent: 'test-agent',
  });
  assert.equal(lead.name, 'Test Person');
  assert.equal(lead.source, 'website');
  assert.equal(lead.consent.text, PROPERTIES_CONSENT_TEXT);
  assert.equal(lead.consent.version, PROPERTIES_CONSENT_VERSION);
  assert.equal(lead.consent.ip, '1.2.3.4');
  assert.equal(lead.consent.userAgent, 'test-agent');
  assert.equal(lead.consent.pagePath, '/properties');
  assert.ok(lead.consent.timestamp);

  assert.equal(await countRecentPropertiesLeadsByIp(db, '1.2.3.4', 10), 1);
  assert.equal(await countRecentPropertiesLeadsByIp(db, '9.9.9.9', 10), 0);
  assert.equal(await countRecentPropertiesLeadsByIp(db, 'unknown', 10), 0);
  assert.equal((await findRecentPropertiesLeadByMobile(db, '9876543210', 30))?.id, lead.id);
  assert.equal(await findRecentPropertiesLeadByMobile(db, '9000000001', 30), null);

  assert.ok(OPS_LEAD_SOURCES.includes('properties'));
  assert.ok(OPS_LEAD_SOURCE_LABELS.properties);
  assert.equal(LEAD_ADAPTER_BY_SOURCE.properties, propertiesAdapter);
  const listed = await propertiesAdapter.fetchLeads(db, { limit: 10 });
  assert.equal(listed.length, 1);
  assert.equal(listed[0].source, 'properties');
  assert.equal(listed[0].phone, '9876543210');
  assert.equal(listed[0].category, 'rental');
  assert.equal(listed[0].intent, 'Rent out my flat');
  const byId = await propertiesAdapter.fetchLeadById(db, lead.id);
  assert.equal(byId?.name, 'Test Person');
  assert.equal(await propertiesAdapter.countLeads(db, {}), 1);

  console.log('properties-leads: all assertions passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
