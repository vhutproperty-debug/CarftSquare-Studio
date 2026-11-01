/**
 * Upsert WhatsApp-group brokers into MongoDB by phone.
 *
 * The spreadsheet is private. Do not commit it. This script prints counts only.
 *
 *   npx tsx scripts/import-broker-crm.ts --file /absolute/path/to/brokers.xlsx
 *
 * Requires MONGODB_URI (and DB_NAME, if you use one) in .env.local.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvLocal } from './lib/load-env-local.mjs';
import { getDb } from '../lib/mongodb';
import { parseBrokerCrmFile } from '../lib/ops/broker-crm/parse';
import { importBrokerCrmRows } from '../lib/ops/broker-crm/store';

loadEnvLocal();

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

async function main() {
  const file = argument('--file');
  if (!file) {
    console.error('Usage: npx tsx scripts/import-broker-crm.ts --file /absolute/path/to/brokers.xlsx');
    process.exit(1);
  }
  const bytes = readFileSync(resolve(file));
  const rows = parseBrokerCrmFile(file, bytes);
  const stats = await importBrokerCrmRows(await getDb(), rows);
  console.log(JSON.stringify({
    rows: stats.rows,
    created: stats.created,
    updated: stats.updated,
    unchanged: stats.unchanged,
    skipped: stats.skipped,
    dedupedInFile: stats.dedupedInFile,
    priority: stats.priority,
    admins: stats.admins,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Import failed');
  process.exit(1);
});
