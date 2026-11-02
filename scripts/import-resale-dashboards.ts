/**
 * Upsert resale projects and units from local HTML dashboards.
 *
 * The HTML files hold owner phone numbers. Do not commit them.
 * This script prints counts only.
 *
 *   npx tsx scripts/import-resale-dashboards.ts --dir /absolute/path/to/dashboards
 *
 * It reads every .html file in that directory:
 *   Oberoi Sky City  — const inventory = [...]
 *   Oberoi Elysian   — const DATA = {...}
 *   34 Park          — const DATA = {...} with live and diary
 *
 * Re-running updates dashboard fields and keeps follow-up notes added inside ops.
 * Requires MONGODB_URI (and DB_NAME, if you use one) in .env.local.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadEnvLocal } from './lib/load-env-local.mjs';
import {
  mergeDashboardNotes,
  parseDashboardHtml,
  type ImportedResaleUnit,
} from '../lib/ops/projects/parse-resale-dashboards';
import {
  getProjectsDatabase,
  getResaleProject,
  getResaleUnit,
  saveResaleProject,
  saveResaleUnit,
} from '../lib/ops/projects/store';

loadEnvLocal();

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

async function main() {
  const dir = argument('--dir');
  if (!dir) {
    console.error('Usage: npx tsx scripts/import-resale-dashboards.ts --dir /absolute/path/to/dashboards');
    process.exit(1);
  }
  const folder = resolve(dir);
  const files = readdirSync(folder).filter((name) => name.toLowerCase().endsWith('.html'));
  if (!files.length) throw new Error('No .html files in that directory.');
  const db = await getProjectsDatabase();
  const report: Array<Record<string, unknown>> = [];
  for (const file of files) {
    const html = readFileSync(join(folder, file), 'utf8');
    let bundle;
    try {
      bundle = parseDashboardHtml(html, file);
    } catch (error) {
      report.push({ file, skipped: error instanceof Error ? error.message : 'unreadable' });
      continue;
    }
    const existingProject = await getResaleProject(db, bundle.project.slug);
    const notes = mergeDashboardNotes(existingProject?.notes || '', bundle.project.notes);
    const towers = [...new Set([...(existingProject?.towers || []), ...bundle.project.towers])];
    await saveResaleProject(db, {
      slug: bundle.project.slug,
      name: bundle.project.name,
      patch: {
        name: bundle.project.name,
        developer: bundle.project.developer || existingProject?.developer || '',
        locality: bundle.project.locality,
        towers,
        notes,
        focus: 'resale',
      },
    }, 'import');
    let created = 0;
    let updated = 0;
    let followUps = 0;
    for (const unit of bundle.units) {
      const result = await upsertUnit(db, unit);
      if (result === 'created') created += 1;
      else updated += 1;
      followUps += unit.followUps.length;
    }
    report.push({
      file,
      project: bundle.project.slug,
      units: bundle.units.length,
      created,
      updated,
      followUps,
    });
  }
  console.log(JSON.stringify({ imported: report }));
}

async function upsertUnit(db: Awaited<ReturnType<typeof getProjectsDatabase>>, unit: ImportedResaleUnit) {
  const existing = await getResaleUnit(db, unit.slug);
  const kept = (existing?.followUps || []).filter((entry) => entry.source === 'ops');
  const followUps = [...unit.followUps, ...kept];
  const saved = await saveResaleUnit(db, {
    slug: unit.slug,
    projectSlug: unit.projectSlug,
    patch: {
      ...unit,
      followUps,
    },
  }, 'import');
  return saved.created ? 'created' : 'updated';
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Import failed');
  process.exit(1);
});
