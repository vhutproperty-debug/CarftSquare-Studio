/**
 * Import developer launches and seed empty Oberoi resale groupings.
 *
 * The spreadsheet is not committed. Pass it with --file.
 *
 *   npx tsx scripts/import-projects.ts
 *   npx tsx scripts/import-projects.ts --file /absolute/path/to/Andheri_Goregaon_Launches.xlsx
 *
 * With or without the spreadsheet, this also upserts the 14 public sales-desk
 * contacts in data/ops/project-sales-contacts.json. Those addresses stay unverified
 * until someone on the team marks them verified.
 *
 * Sheet names become the locality (Andheri West, Goregaon West).
 * Re-running updates launch fields and keeps contacts, notes, USPs, amenities,
 * floor plans, brochure, and channel-partner status already stored.
 * Oberoi Esquire, Exquisite, Elysian, and Sky City are inserted only when missing.
 * No units are created.
 *
 * Requires MONGODB_URI (and DB_NAME, if you use one) in .env.local.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvLocal } from './lib/load-env-local.mjs';
import { draftsFromLaunchSheets } from '../lib/ops/projects/parse-launch-sheet';
import {
  applySalesContactSeed,
  getProjectsDatabase,
  importDeveloperDraft,
  seedResalePlaceholders,
} from '../lib/ops/projects/store';
import { readXlsxSheets } from '../lib/ops/projects/xlsx';

loadEnvLocal();

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

async function main() {
  const file = argument('--file');
  const db = await getProjectsDatabase();
  let created = 0;
  let updated = 0;
  let drafts: Awaited<ReturnType<typeof draftsFromLaunchSheets>> = [];
  if (file) {
    const sheets = readXlsxSheets(readFileSync(resolve(file)));
    drafts = draftsFromLaunchSheets(sheets);
    for (const draft of drafts) {
      const result = await importDeveloperDraft(db, draft, 'import');
      if (result === 'created') created += 1;
      else updated += 1;
    }
  }
  const salesContacts = await applySalesContactSeed(db, 'import');
  const resale = await seedResalePlaceholders(db, 'import');
  const localities = drafts.reduce<Record<string, number>>((counts, draft) => {
    counts[draft.locality] = (counts[draft.locality] || 0) + 1;
    return counts;
  }, {});
  console.log(JSON.stringify({
    developer: file ? { parsed: drafts.length, created, updated, localities, slugs: drafts.map((draft) => draft.slug) } : { skipped: true },
    salesContacts,
    resaleProjects: resale,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Import failed');
  process.exit(1);
});
