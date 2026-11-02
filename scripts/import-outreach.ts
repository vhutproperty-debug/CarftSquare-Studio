/**
 * Upsert outreach contacts and message templates.
 * The CSV and JSON stay on disk. This script prints counts only.
 *
 *   npx tsx scripts/import-outreach.ts --file /absolute/path/contacts.csv --templates /absolute/path/templates.json
 *
 * CSV columns: audience, wave, priority, project, tower, floor, bhk, flats, name, role,
 * phone, email, signal, lease_end, already_contacted, status, notes, message.
 * Templates JSON is keyed by audience. Body may use {first_name}, {project}, {tower}.
 * Dedupe is phone + audience. Requires MONGODB_URI in .env.local.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvLocal } from './lib/load-env-local.mjs';
import { parseOutreachCsv, parseTemplatesJson } from '../lib/ops/outreach/parse';
import { getOutreachDatabase, saveOutreach, saveTemplate } from '../lib/ops/outreach/store';
import type { OutreachAudience } from '../lib/ops/outreach/types';

loadEnvLocal();

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

async function main() {
  const file = argument('--file');
  if (!file) {
    console.error('Usage: npx tsx scripts/import-outreach.ts --file /absolute/path/contacts.csv --templates /absolute/path/templates.json');
    process.exit(1);
  }
  const rows = parseOutreachCsv(readFileSync(resolve(file), 'utf8'));
  const db = await getOutreachDatabase();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  for (const row of rows) {
    try {
      const result = await saveOutreach(db, {
        ...row,
        phone_e164: row.phone,
        flats: (row.flats || '').split(/[;|]/).map((item) => item.trim()).filter(Boolean),
        already_contacted: ['1', 'yes', 'true'].includes((row.already_contacted || '').toLowerCase()),
      }, 'import');
      if (result.created) created += 1;
      else updated += 1;
    } catch {
      skipped += 1;
    }
  }
  let templates = 0;
  const templateFile = argument('--templates');
  if (templateFile) {
    const parsed = parseTemplatesJson(readFileSync(resolve(templateFile), 'utf8'));
    for (const [audience, body] of Object.entries(parsed)) {
      if (!body) continue;
      await saveTemplate(db, audience as OutreachAudience, body, 'import');
      templates += 1;
    }
  }
  console.log(JSON.stringify({ rows: rows.length, created, updated, skipped, templates }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Import failed');
  process.exit(1);
});
