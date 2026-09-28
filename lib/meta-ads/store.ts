import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import type {
  MetaAdsCampaignRecord,
  MetaAdsCampaignRecordStatus,
  MetaAdsCreative,
  MetaAdsCreativeStatus,
} from '@/lib/meta-ads/types';

export const META_ADS_CREATIVES_COLLECTION = 'ops_meta_ad_creatives';
export const META_ADS_CAMPAIGNS_COLLECTION = 'ops_meta_ad_campaigns';

let indexesEnsured = false;

export async function getMetaAdsDatabase(): Promise<Db> {
  return getDb() as Promise<Db>;
}

export async function ensureMetaAdsIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  await db.collection(META_ADS_CREATIVES_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(META_ADS_CREATIVES_COLLECTION).createIndex({ status: 1, createdAt: -1 });
  await db.collection(META_ADS_CAMPAIGNS_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(META_ADS_CAMPAIGNS_COLLECTION).createIndex({ status: 1, createdAt: -1 });
  await db.collection(META_ADS_CAMPAIGNS_COLLECTION).createIndex({ creativeId: 1 });
  indexesEnsured = true;
}

export async function insertCreatives(
  db: Db,
  creatives: Omit<MetaAdsCreative, 'id' | 'createdAt' | 'updatedAt' | 'status'>[],
): Promise<MetaAdsCreative[]> {
  await ensureMetaAdsIndexes(db);
  const now = new Date().toISOString();
  const docs: MetaAdsCreative[] = creatives.map((c) => ({
    ...c,
    id: uuidv4(),
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  }));
  if (docs.length) await db.collection(META_ADS_CREATIVES_COLLECTION).insertMany(docs);
  return docs;
}

export async function listCreatives(db: Db, limit = 50): Promise<MetaAdsCreative[]> {
  await ensureMetaAdsIndexes(db);
  return (await db
    .collection(META_ADS_CREATIVES_COLLECTION)
    .find({}, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray()) as unknown as MetaAdsCreative[];
}

export async function getCreative(db: Db, id: string): Promise<MetaAdsCreative | null> {
  await ensureMetaAdsIndexes(db);
  return (await db.collection(META_ADS_CREATIVES_COLLECTION).findOne(
    { id },
    { projection: { _id: 0 } },
  )) as MetaAdsCreative | null;
}

export async function updateCreativeStatus(
  db: Db,
  id: string,
  status: MetaAdsCreativeStatus,
  patch?: Partial<MetaAdsCreative>,
): Promise<MetaAdsCreative | null> {
  await ensureMetaAdsIndexes(db);
  const now = new Date().toISOString();
  await db.collection(META_ADS_CREATIVES_COLLECTION).updateOne(
    { id },
    { $set: { status, updatedAt: now, ...patch } },
  );
  return getCreative(db, id);
}

export async function createCampaignRecord(
  db: Db,
  input: Omit<MetaAdsCampaignRecord, 'id' | 'createdAt' | 'updatedAt' | 'dryRun' | 'metaStatus'>,
): Promise<MetaAdsCampaignRecord> {
  await ensureMetaAdsIndexes(db);
  const now = new Date().toISOString();
  const doc: MetaAdsCampaignRecord = {
    ...input,
    id: uuidv4(),
    dryRun: true,
    metaStatus: 'NONE',
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(META_ADS_CAMPAIGNS_COLLECTION).insertOne(doc);
  return doc;
}

export async function listCampaignRecords(db: Db, limit = 50): Promise<MetaAdsCampaignRecord[]> {
  await ensureMetaAdsIndexes(db);
  return (await db
    .collection(META_ADS_CAMPAIGNS_COLLECTION)
    .find({}, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray()) as unknown as MetaAdsCampaignRecord[];
}

export async function getCampaignRecord(db: Db, id: string): Promise<MetaAdsCampaignRecord | null> {
  await ensureMetaAdsIndexes(db);
  return (await db.collection(META_ADS_CAMPAIGNS_COLLECTION).findOne(
    { id },
    { projection: { _id: 0 } },
  )) as MetaAdsCampaignRecord | null;
}

export async function updateCampaignRecord(
  db: Db,
  id: string,
  patch: Partial<MetaAdsCampaignRecord> & { status?: MetaAdsCampaignRecordStatus },
): Promise<MetaAdsCampaignRecord | null> {
  await ensureMetaAdsIndexes(db);
  const now = new Date().toISOString();
  await db.collection(META_ADS_CAMPAIGNS_COLLECTION).updateOne(
    { id },
    { $set: { ...patch, updatedAt: now } },
  );
  return getCampaignRecord(db, id);
}
