/**
 * Phase 2 skeleton. This script does not read or write contact data.
 *
 * Later it will copy phone, name, and complex from the existing ops collections
 * into `contacts`, `complex_links`, `units`, and `unit_links` without deleting
 * the source rows. Rows missing a unit or email become complex-level links.
 *
 * Sources to fold in, in this order:
 * - outreach_contacts
 * - lease_expiries
 * - rerent_leases
 * - portfolio_owners
 * - ops_resale_units
 * - ops_broker_crm
 * - ops_supply_records
 * - ops_demand_records
 * - ops_prospects
 * - wa_contacts
 *
 * Run: npx tsx scripts/migrate-ops-contacts.ts
 */
const SOURCES = [
  'outreach_contacts',
  'lease_expiries',
  'rerent_leases',
  'portfolio_owners',
  'ops_resale_units',
  'ops_broker_crm',
  'ops_supply_records',
  'ops_demand_records',
  'ops_prospects',
  'wa_contacts',
];

const apply = process.argv.includes('--apply');

console.log('Ops contacts migration skeleton');
console.log('Target collections: contacts, complex_links, units, unit_links, interactions, tasks');
console.log('Match key: normalized E.164 phone. Never overwrite a non-empty field. Flag suspected brokers as VERIFY.');
console.log('Source collections left untouched:');
for (const name of SOURCES) console.log(`- ${name}`);

if (apply) {
  console.error('Applying the migration is phase 2. No data was changed.');
  process.exit(2);
}

console.log('Dry run only. Nothing was read from or written to MongoDB.');
