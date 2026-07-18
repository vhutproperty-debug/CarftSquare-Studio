/**
 * Alias-aware project normalization.
 * V2: primary source is ops_project_aliases; seed bootstrap when empty.
 * Unknown projects are NOT auto-aliased.
 */

import type { Db } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { PROJECT_ALIAS_CONFIG, PROJECT_ALIAS_SEED } from '@/lib/ops/brokers/config';
import type { OpsProjectAlias, OpsUnknownProjectSighting } from '@/lib/ops/brokers/types';

export const PROJECT_ALIASES_COLLECTION = 'ops_project_aliases';
export const UNKNOWN_PROJECTS_COLLECTION = 'ops_unknown_projects';

let cache: Map<string, string> | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 60_000;

export function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

let projectAliasIndexesEnsured = false;

export async function ensureProjectAliasIndexes(db: Db): Promise<void> {
  if (projectAliasIndexesEnsured) return;
  await db.collection(PROJECT_ALIASES_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(PROJECT_ALIASES_COLLECTION).createIndex({ canonicalProject: 1 }, { unique: true });
  await db.collection(PROJECT_ALIASES_COLLECTION).createIndex({ aliases: 1 });
  await db.collection(PROJECT_ALIASES_COLLECTION).createIndex({ active: 1 });
  await db.collection(UNKNOWN_PROJECTS_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(UNKNOWN_PROJECTS_COLLECTION).createIndex({ normalizedKey: 1 }, { unique: true });
  await db.collection(UNKNOWN_PROJECTS_COLLECTION).createIndex({ count: -1 });
  projectAliasIndexesEnsured = true;
}

async function seedAliasesIfEmpty(db: Db): Promise<void> {
  const count = await db.collection(PROJECT_ALIASES_COLLECTION).countDocuments({});
  if (count > 0) return;
  const now = new Date().toISOString();
  const docs: OpsProjectAlias[] = PROJECT_ALIAS_SEED.map((seed) => ({
    id: uuidv4(),
    canonicalProject: seed.canonicalProject,
    aliases: seed.aliases.map(normalizeKey),
    city: seed.city,
    locality: seed.locality,
    builder: seed.builder,
    active: true,
    createdAt: now,
    updatedAt: now,
  }));
  if (docs.length) {
    await db.collection(PROJECT_ALIASES_COLLECTION).insertMany(docs);
  }
}

export async function loadAliasMap(db: Db, force = false): Promise<Map<string, string>> {
  const now = Date.now();
  if (!force && cache && now - cacheLoadedAt < CACHE_TTL_MS) return cache;

  await ensureProjectAliasIndexes(db);
  await seedAliasesIfEmpty(db);

  const rows = await db
    .collection<OpsProjectAlias>(PROJECT_ALIASES_COLLECTION)
    .find({ active: true })
    .toArray();

  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(normalizeKey(row.canonicalProject), row.canonicalProject);
    for (const alias of row.aliases) {
      map.set(normalizeKey(alias), row.canonicalProject);
    }
  }
  cache = map;
  cacheLoadedAt = now;
  return map;
}

export function invalidateAliasCache(): void {
  cache = null;
  cacheLoadedAt = 0;
}

function titleCase(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

export type ProjectNormalizeResult = {
  projectName?: string;
  projectNormalized?: string;
  projectMapped: boolean;
};

/**
 * Sync helper used when alias map is already loaded (import hot path).
 */
export function normalizeProjectNameWithMap(
  raw: string | null | undefined,
  aliasMap: Map<string, string>,
): ProjectNormalizeResult {
  if (!raw?.trim()) {
    return { projectMapped: false };
  }
  const key = normalizeKey(raw);
  if (!key) return { projectMapped: false };

  const exact = aliasMap.get(key);
  if (exact) {
    return {
      projectName: exact,
      projectNormalized: normalizeKey(exact),
      projectMapped: true,
    };
  }

  let best: { canonical: string; len: number } | null = null;
  for (const [alias, canonical] of aliasMap.entries()) {
    if (alias.length < 4) continue;
    if (key.includes(alias) || alias.includes(key)) {
      if (!best || alias.length > best.len) best = { canonical, len: alias.length };
    }
  }
  if (best) {
    return {
      projectName: best.canonical,
      projectNormalized: normalizeKey(best.canonical),
      projectMapped: true,
    };
  }

  const display = titleCase(raw);
  return {
    projectName: display,
    projectNormalized: normalizeKey(display),
    projectMapped: false,
  };
}

/** Async normalizer — queries DB-backed aliases. */
export async function normalizeProjectName(
  raw?: string | null,
  db?: Db,
): Promise<string | undefined> {
  if (!raw?.trim()) return undefined;
  if (!db) {
    // Fallback title-case only (no silent alias invent). Used by sync extract helpers.
    return titleCase(raw);
  }
  const map = await loadAliasMap(db);
  return normalizeProjectNameWithMap(raw, map).projectName;
}

export async function projectNormalizedKey(
  raw?: string | null,
  db?: Db,
): Promise<string | undefined> {
  const name = await normalizeProjectName(raw, db);
  return name ? normalizeKey(name) : undefined;
}

export async function trackUnknownProject(
  db: Db,
  input: {
    projectName: string;
    groupName?: string;
    batchId?: string;
    messageId?: string;
  },
): Promise<void> {
  await bulkTrackUnknownProjects(db, [input]);
}

/** Batch unknown-project sightings (same semantics as trackUnknownProject). */
export async function bulkTrackUnknownProjects(
  db: Db,
  inputs: Array<{
    projectName: string;
    groupName?: string;
    batchId?: string;
    messageId?: string;
  }>,
): Promise<number> {
  if (!PROJECT_ALIAS_CONFIG.trackUnknownProjects) return 0;
  if (PROJECT_ALIAS_CONFIG.autoCreateAliases) return 0;
  if (!inputs.length) return 0;

  await ensureProjectAliasIndexes(db);
  const now = new Date().toISOString();
  const col = db.collection<OpsUnknownProjectSighting>(UNKNOWN_PROJECTS_COLLECTION);

  const aggregated = new Map<
    string,
    { projectName: string; groupName?: string; batchId?: string; messageId?: string; count: number }
  >();
  for (const input of inputs) {
    const key = normalizeKey(input.projectName);
    if (!key || key.length < 3) continue;
    const cur = aggregated.get(key);
    if (cur) {
      cur.count += 1;
      cur.groupName = input.groupName || cur.groupName;
      cur.batchId = input.batchId || cur.batchId;
      cur.messageId = input.messageId || cur.messageId;
    } else {
      aggregated.set(key, {
        projectName: input.projectName,
        groupName: input.groupName,
        batchId: input.batchId,
        messageId: input.messageId,
        count: 1,
      });
    }
  }
  if (!aggregated.size) return 0;

  const keys = [...aggregated.keys()];
  const existingRows = await col.find({ normalizedKey: { $in: keys } }).toArray();
  const existingByKey = new Map(existingRows.map((r) => [r.normalizedKey, r]));

  const ops: Array<
    | {
        updateOne: {
          filter: { id: string };
          update: {
            $inc: { count: number };
            $set: Record<string, unknown>;
          };
        };
      }
    | { insertOne: { document: OpsUnknownProjectSighting } }
  > = [];

  for (const [key, agg] of aggregated) {
    const existing = existingByKey.get(key);
    if (existing) {
      ops.push({
        updateOne: {
          filter: { id: existing.id },
          update: {
            $inc: { count: agg.count },
            $set: {
              lastSeenAt: now,
              groupName: agg.groupName || existing.groupName,
              batchId: agg.batchId || existing.batchId,
              messageId: agg.messageId || existing.messageId,
            },
          },
        },
      });
    } else {
      ops.push({
        insertOne: {
          document: {
            id: uuidv4(),
            projectName: agg.projectName,
            normalizedKey: key,
            groupName: agg.groupName,
            batchId: agg.batchId,
            messageId: agg.messageId,
            count: agg.count,
            firstSeenAt: now,
            lastSeenAt: now,
          },
        },
      });
    }
  }

  if (ops.length) await col.bulkWrite(ops as never, { ordered: false });
  return aggregated.size;
}

export async function listProjectAliases(
  db: Db,
  opts?: { activeOnly?: boolean },
): Promise<OpsProjectAlias[]> {
  await ensureProjectAliasIndexes(db);
  await seedAliasesIfEmpty(db);
  const filter = opts?.activeOnly === false ? {} : { active: true };
  return db
    .collection<OpsProjectAlias>(PROJECT_ALIASES_COLLECTION)
    .find(filter)
    .sort({ canonicalProject: 1 })
    .toArray();
}

export async function createProjectAlias(
  db: Db,
  payload: {
    canonicalProject: string;
    aliases: string[];
    city?: string;
    locality?: string;
    builder?: string;
    active?: boolean;
  },
): Promise<OpsProjectAlias> {
  await ensureProjectAliasIndexes(db);
  const now = new Date().toISOString();
  const doc: OpsProjectAlias = {
    id: uuidv4(),
    canonicalProject: payload.canonicalProject.trim(),
    aliases: payload.aliases.map(normalizeKey).filter(Boolean),
    city: payload.city,
    locality: payload.locality,
    builder: payload.builder,
    active: payload.active ?? true,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(PROJECT_ALIASES_COLLECTION).insertOne(doc);
  invalidateAliasCache();
  return doc;
}

export async function updateProjectAlias(
  db: Db,
  id: string,
  patch: Partial<OpsProjectAlias>,
): Promise<OpsProjectAlias | null> {
  await ensureProjectAliasIndexes(db);
  const $set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (patch.canonicalProject != null) $set.canonicalProject = patch.canonicalProject.trim();
  if (patch.aliases != null) $set.aliases = patch.aliases.map(normalizeKey);
  if (patch.city !== undefined) $set.city = patch.city;
  if (patch.locality !== undefined) $set.locality = patch.locality;
  if (patch.builder !== undefined) $set.builder = patch.builder;
  if (patch.active !== undefined) $set.active = patch.active;
  await db.collection(PROJECT_ALIASES_COLLECTION).updateOne({ id }, { $set });
  invalidateAliasCache();
  return db.collection<OpsProjectAlias>(PROJECT_ALIASES_COLLECTION).findOne({ id });
}

export async function deleteProjectAlias(db: Db, id: string): Promise<boolean> {
  await ensureProjectAliasIndexes(db);
  const result = await db.collection(PROJECT_ALIASES_COLLECTION).deleteOne({ id });
  invalidateAliasCache();
  return result.deletedCount > 0;
}

export async function listUnknownProjects(
  db: Db,
  limit = 100,
): Promise<OpsUnknownProjectSighting[]> {
  await ensureProjectAliasIndexes(db);
  return db
    .collection<OpsUnknownProjectSighting>(UNKNOWN_PROJECTS_COLLECTION)
    .find({})
    .sort({ count: -1, lastSeenAt: -1 })
    .limit(limit)
    .toArray();
}
