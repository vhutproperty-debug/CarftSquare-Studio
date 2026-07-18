import { v4 as uuidv4 } from 'uuid';
import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import { ensureKnowledgeGraphIndexes } from '@/lib/research/graph/indexes';
import { slug } from '@/lib/research/graph/identity';
import type {
  KgBroker,
  KgBuilder,
  KgBuilding,
  KgLocality,
  KgPortalNode,
  KgProject,
  KgProperty,
  KgTower,
} from '@/lib/research/graph/types';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';

async function dbReady() {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  await ensureKnowledgeGraphIndexes(db);
  return db;
}

export async function findPropertyByFingerprint(
  workspaceId: string,
  fingerprint: string,
  altFingerprints: string[] = [],
): Promise<KgProperty | null> {
  const db = await dbReady();
  const col = db.collection<KgProperty>(RESEARCH_COLLECTIONS.kgProperties);
  const direct = await col.findOne({
    workspaceId,
    'identity.fingerprint': fingerprint,
  });
  if (direct) return direct;
  if (!altFingerprints.length) return null;
  return col.findOne({
    workspaceId,
    $or: [
      { 'identity.fingerprint': { $in: altFingerprints } },
      { 'identity.altFingerprints': { $in: [fingerprint, ...altFingerprints] } },
    ],
  });
}

export async function getPropertyById(id: string): Promise<KgProperty | null> {
  const db = await dbReady();
  return db.collection<KgProperty>(RESEARCH_COLLECTIONS.kgProperties).findOne({ id });
}

export async function upsertNamedEntity<T extends { id: string; nameKey: string }>(
  collection: string,
  workspaceId: string,
  name: string,
  create: (id: string, nameKey: string, now: string) => T,
  touch?: (existing: T, now: string) => Partial<T>,
): Promise<T> {
  const db = await dbReady();
  const nameKey = slug(name);
  const col = db.collection<T>(collection);
  const existing = (await col.findOne({ workspaceId, nameKey } as object)) as T | null;
  const now = new Date().toISOString();
  if (existing) {
    const patch = touch ? touch(existing, now) : ({ updatedAt: now } as unknown as Partial<T>);
    await col.updateOne({ id: existing.id } as object, { $set: patch });
    return { ...existing, ...patch } as T;
  }
  const created = create(uuidv4(), nameKey, now);
  await col.insertOne(created as never);
  return created;
}

export async function upsertProject(
  workspaceId: string,
  name: string,
  localityName?: string,
): Promise<KgProject> {
  return upsertNamedEntity<KgProject>(
    RESEARCH_COLLECTIONS.kgProjects,
    workspaceId,
    name,
    (id, nameKey, now) => ({
      id,
      workspaceId,
      name,
      nameKey,
      localityName,
      propertyCount: 0,
      rentalInventory: 0,
      saleInventory: 0,
      portalDistribution: {},
      topBrokerIds: [],
      newListings7d: 0,
      removedListings7d: 0,
      inventoryTrend: [],
      priceTrend: [],
      firstSeenAt: now,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    }),
    (existing, now) => ({
      lastSeenAt: now,
      updatedAt: now,
      localityName: localityName || existing.localityName,
    }),
  );
}

export async function upsertLocality(
  workspaceId: string,
  name: string,
  city?: string,
): Promise<KgLocality> {
  return upsertNamedEntity<KgLocality>(
    RESEARCH_COLLECTIONS.kgLocalities,
    workspaceId,
    name,
    (id, nameKey, now) => ({
      id,
      workspaceId,
      name,
      nameKey,
      city,
      propertyCount: 0,
      inventoryVolume: 0,
      popularConfigurations: {},
      brokerConcentration: {},
      builderConcentration: {},
      priceMovement: [],
      marketActivity7d: 0,
      firstSeenAt: now,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    }),
    (_e, now) => ({ lastSeenAt: now, updatedAt: now, city }),
  );
}

export async function upsertBroker(workspaceId: string, name: string): Promise<KgBroker> {
  return upsertNamedEntity<KgBroker>(
    RESEARCH_COLLECTIONS.kgBrokers,
    workspaceId,
    name,
    (id, nameKey, now) => ({
      id,
      workspaceId,
      name,
      nameKey,
      activeListingCount: 0,
      exclusiveInventoryCount: 0,
      projectsCovered: [],
      portals: [],
      listingQualityScore: 50,
      duplicateBehaviorScore: 50,
      responseFrequency: 0,
      observationCount: 0,
      firstSeenAt: now,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    }),
    (_e, now) => ({ lastSeenAt: now, updatedAt: now }),
  );
}

export async function upsertBuilder(workspaceId: string, name: string): Promise<KgBuilder> {
  return upsertNamedEntity<KgBuilder>(
    RESEARCH_COLLECTIONS.kgBuilders,
    workspaceId,
    name,
    (id, nameKey, now) => ({
      id,
      workspaceId,
      name,
      nameKey,
      projectIds: [],
      propertyCount: 0,
      createdAt: now,
      updatedAt: now,
    }),
    (_e, now) => ({ updatedAt: now }),
  );
}

export async function upsertBuilding(
  workspaceId: string,
  name: string,
  projectId?: string,
): Promise<KgBuilding> {
  const db = await dbReady();
  const nameKey = slug(name);
  const col = db.collection<KgBuilding>(RESEARCH_COLLECTIONS.kgBuildings);
  const existing = await col.findOne({ workspaceId, nameKey, projectId });
  const now = new Date().toISOString();
  if (existing) {
    await col.updateOne({ id: existing.id }, { $set: { updatedAt: now } });
    return { ...existing, updatedAt: now };
  }
  const created: KgBuilding = {
    id: uuidv4(),
    workspaceId,
    projectId,
    name,
    nameKey,
    propertyCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  await col.insertOne(created);
  return created;
}

export async function upsertTower(
  workspaceId: string,
  name: string,
  projectId?: string,
  buildingId?: string,
): Promise<KgTower> {
  const db = await dbReady();
  const nameKey = slug(name);
  const col = db.collection<KgTower>(RESEARCH_COLLECTIONS.kgTowers);
  const existing = await col.findOne({ workspaceId, nameKey, projectId });
  const now = new Date().toISOString();
  if (existing) {
    await col.updateOne({ id: existing.id }, { $set: { updatedAt: now } });
    return { ...existing, updatedAt: now };
  }
  const created: KgTower = {
    id: uuidv4(),
    workspaceId,
    projectId,
    buildingId,
    name,
    nameKey,
    propertyCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  await col.insertOne(created);
  return created;
}

export async function upsertPortalNode(
  workspaceId: string,
  key: string,
  displayName: string,
): Promise<KgPortalNode> {
  const db = await dbReady();
  const col = db.collection<KgPortalNode>(RESEARCH_COLLECTIONS.kgPortals);
  const existing = await col.findOne({ workspaceId, key });
  const now = new Date().toISOString();
  if (existing) {
    await col.updateOne(
      { id: existing.id },
      { $set: { lastSeenAt: now, updatedAt: now }, $inc: { listingCount: 1 } },
    );
    return {
      ...existing,
      listingCount: existing.listingCount + 1,
      lastSeenAt: now,
      updatedAt: now,
    };
  }
  const created: KgPortalNode = {
    id: uuidv4(),
    workspaceId,
    key,
    displayName,
    listingCount: 1,
    propertyCount: 0,
    brokerCount: 0,
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now,
  };
  await col.insertOne(created);
  return created;
}

export async function saveProperty(property: KgProperty): Promise<void> {
  const db = await dbReady();
  await db.collection(RESEARCH_COLLECTIONS.kgProperties).updateOne(
    { id: property.id },
    { $set: property },
    { upsert: true },
  );
}

export async function getProjectById(id: string): Promise<KgProject | null> {
  const db = await dbReady();
  return db.collection<KgProject>(RESEARCH_COLLECTIONS.kgProjects).findOne({ id });
}

export async function getBrokerById(id: string): Promise<KgBroker | null> {
  const db = await dbReady();
  return db.collection<KgBroker>(RESEARCH_COLLECTIONS.kgBrokers).findOne({ id });
}

export async function getLocalityById(id: string): Promise<KgLocality | null> {
  const db = await dbReady();
  return db.collection<KgLocality>(RESEARCH_COLLECTIONS.kgLocalities).findOne({ id });
}
