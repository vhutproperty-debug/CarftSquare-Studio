import { v4 as uuidv4 } from 'uuid';
import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import { slug } from '@/lib/research/graph/identity';
import { ensureKnowledgeGraphIndexes } from '@/lib/research/graph/indexes';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';

export type KgAliasEntityType = 'project' | 'builder' | 'locality' | 'broker';

export type KgAlias = {
  id: string;
  workspaceId: string;
  entityType: KgAliasEntityType;
  canonicalName: string;
  canonicalKey: string;
  alias: string;
  aliasKey: string;
  createdAt: string;
  updatedAt: string;
};

const BUILTIN_PROJECT_ALIASES: Array<{ canonical: string; aliases: string[] }> = [
  {
    canonical: 'Oberoi Sky City',
    aliases: ['SkyCity', 'Sky City', 'Oberoi SkyCity', 'Oberoi Skycity', 'OSC'],
  },
  {
    canonical: 'Oberoi Esquire',
    aliases: ['Esquire', 'Oberoi Esquire Goregaon'],
  },
  {
    canonical: 'Rustomjee Summit',
    aliases: ['Summit', 'Rustomjee Summit Tower'],
  },
  {
    canonical: 'Kalpataru Immensa',
    aliases: ['Immensa', 'Kalpataru Immense'],
  },
  {
    canonical: 'Lodha Meridian',
    aliases: ['Meridian', 'Lodha Meridian Thane'],
  },
];

async function dbReady() {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  await ensureKnowledgeGraphIndexes(db);
  return db;
}

export async function ensureBuiltinAliases(workspaceId: string): Promise<void> {
  const db = await dbReady();
  const col = db.collection<KgAlias>(RESEARCH_COLLECTIONS.kgAliases);
  const now = new Date().toISOString();
  for (const row of BUILTIN_PROJECT_ALIASES) {
    const canonicalKey = slug(row.canonical);
    const names = [row.canonical, ...row.aliases];
    for (const alias of names) {
      const aliasKey = slug(alias);
      if (!aliasKey) continue;
      const existing = await col.findOne({ workspaceId, entityType: 'project', aliasKey });
      if (existing) continue;
      await col.insertOne({
        id: uuidv4(),
        workspaceId,
        entityType: 'project',
        canonicalName: row.canonical,
        canonicalKey,
        alias,
        aliasKey,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}

export async function registerAlias(input: {
  workspaceId: string;
  entityType: KgAliasEntityType;
  canonicalName: string;
  alias: string;
}): Promise<KgAlias> {
  const db = await dbReady();
  const aliasKey = slug(input.alias);
  const canonicalKey = slug(input.canonicalName);
  const existing = await db.collection<KgAlias>(RESEARCH_COLLECTIONS.kgAliases).findOne({
    workspaceId: input.workspaceId,
    entityType: input.entityType,
    aliasKey,
  });
  if (existing) return existing;
  const now = new Date().toISOString();
  const doc: KgAlias = {
    id: uuidv4(),
    workspaceId: input.workspaceId,
    entityType: input.entityType,
    canonicalName: input.canonicalName,
    canonicalKey,
    alias: input.alias,
    aliasKey,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(RESEARCH_COLLECTIONS.kgAliases).insertOne(doc);
  return doc;
}

/** Resolve any alias (or exact name) to a canonical display name. */
export async function resolveCanonicalName(
  workspaceId: string,
  entityType: KgAliasEntityType,
  name: string,
): Promise<string> {
  await ensureBuiltinAliases(workspaceId);
  const key = slug(name);
  if (!key) return name.trim();
  const db = await dbReady();
  const hit = await db.collection<KgAlias>(RESEARCH_COLLECTIONS.kgAliases).findOne({
    workspaceId,
    entityType,
    aliasKey: key,
  });
  return hit?.canonicalName || name.trim();
}

export async function listAliases(
  workspaceId: string,
  entityType?: KgAliasEntityType,
): Promise<KgAlias[]> {
  await ensureBuiltinAliases(workspaceId);
  const db = await dbReady();
  const filter: Record<string, unknown> = { workspaceId };
  if (entityType) filter.entityType = entityType;
  return db
    .collection<KgAlias>(RESEARCH_COLLECTIONS.kgAliases)
    .find(filter)
    .sort({ canonicalName: 1, alias: 1 })
    .limit(500)
    .toArray();
}
