/**
 * Upsert lease expiries for the Outreach "Re-rent calls" tab.
 * The CSV stays on disk. This script prints counts only.
 *
 *   npx tsx scripts/import-lease-expiries.ts --file /absolute/path/leases.csv
 *
 * Columns: project, tower, flat, owner_name, owner_phone, tenant_name, tenant_phone,
 * lease_start, lease_end, priority, status, notes.
 * Upserts by project + tower + flat. Requires MONGODB_URI in .env.local.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvLocal } from './lib/load-env-local.mjs';
import { parseLeaseCsv } from '../lib/ops/lease-expiries/parse';
import { getLeaseDatabase, saveLeaseExpiry } from '../lib/ops/lease-expiries/store';

loadEnvLocal();

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

async function main() {
  const file = argument('--file');
  if (!file) {
    console.error('Usage: npx tsx scripts/import-lease-expiries.ts --file /absolute/path/leases.csv');
    process.exit(1);
  }
  const rows = parseLeaseCsv(readFileSync(resolve(file), 'utf8'));
  const db = await getLeaseDatabase();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  for (const row of rows) {
    try {
      const result = await saveLeaseExpiry(db, row, 'import');
      if (result.created) created += 1;
      else updated += 1;
    } catch {
      skipped += 1;
    }
  }
  console.log(JSON.stringify({ rows: rows.length, created, updated, skipped }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Import failed');
  process.exit(1);
});
