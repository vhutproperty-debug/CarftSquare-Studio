import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
// @ts-expect-error JS module without types
import { getDb } from '@/lib/mongodb';
import type { PaintingGalleryItem } from './types';

const COLLECTION = 'painting_gallery_items';

export async function getPaintingGalleryDatabase(): Promise<Db> {
  return getDb();
}

export async function ensurePaintingGalleryIndexes(db: Db): Promise<void> {
  await db.collection(COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ sortOrder: 1, createdAt: -1 });
  await db.collection(COLLECTION).createIndex({ active: 1 });
}

export async function listActivePaintingGalleryItems(db: Db, limit = 24): Promise<PaintingGalleryItem[]> {
  return db
    .collection(COLLECTION)
    .find({ active: true }, { projection: { _id: 0 } })
    .sort({ sortOrder: 1, createdAt: -1 })
    .limit(limit)
    .toArray() as Promise<PaintingGalleryItem[]>;
}

export async function listAllPaintingGalleryItems(db: Db): Promise<PaintingGalleryItem[]> {
  return db
    .collection(COLLECTION)
    .find({}, { projection: { _id: 0 } })
    .sort({ sortOrder: 1, createdAt: -1 })
    .toArray() as Promise<PaintingGalleryItem[]>;
}

export async function savePaintingGalleryItem(
  db: Db,
  payload: Omit<PaintingGalleryItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
): Promise<PaintingGalleryItem> {
  const now = new Date().toISOString();
  if (payload.id) {
    const existing = await db.collection(COLLECTION).findOne({ id: payload.id });
    if (existing) {
      const update = { ...payload, updatedAt: now };
      await db.collection(COLLECTION).updateOne({ id: payload.id }, { $set: update });
      return (await db.collection(COLLECTION).findOne({ id: payload.id }, { projection: { _id: 0 } })) as PaintingGalleryItem;
    }
  }

  const item: PaintingGalleryItem = {
    id: payload.id || uuidv4(),
    title: payload.title,
    imageUrl: payload.imageUrl,
    category: payload.category || '',
    sortOrder: payload.sortOrder ?? 0,
    active: payload.active ?? true,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(COLLECTION).insertOne(item);
  return item;
}

export async function deletePaintingGalleryItem(db: Db, id: string): Promise<boolean> {
  const result = await db.collection(COLLECTION).deleteOne({ id });
  return result.deletedCount > 0;
}
