import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
// @ts-expect-error JS module without types
import { getDb } from '@/lib/mongodb';
import type { PaintingTestimonial } from './types';

const COLLECTION = 'painting_testimonials';

export async function getPaintingTestimonialsDatabase(): Promise<Db> {
  return getDb();
}

export async function ensurePaintingTestimonialIndexes(db: Db): Promise<void> {
  await db.collection(COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ sortOrder: 1, createdAt: -1 });
  await db.collection(COLLECTION).createIndex({ active: 1 });
}

export async function listActivePaintingTestimonials(db: Db, limit = 12): Promise<PaintingTestimonial[]> {
  return db
    .collection(COLLECTION)
    .find({ active: true }, { projection: { _id: 0 } })
    .sort({ sortOrder: 1, createdAt: -1 })
    .limit(limit)
    .toArray() as Promise<PaintingTestimonial[]>;
}

export async function listAllPaintingTestimonials(db: Db): Promise<PaintingTestimonial[]> {
  return db
    .collection(COLLECTION)
    .find({}, { projection: { _id: 0 } })
    .sort({ sortOrder: 1, createdAt: -1 })
    .toArray() as Promise<PaintingTestimonial[]>;
}

export async function savePaintingTestimonial(
  db: Db,
  payload: Omit<PaintingTestimonial, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
): Promise<PaintingTestimonial> {
  const now = new Date().toISOString();
  if (payload.id) {
    const existing = await db.collection(COLLECTION).findOne({ id: payload.id });
    if (existing) {
      const update = { ...payload, updatedAt: now };
      await db.collection(COLLECTION).updateOne({ id: payload.id }, { $set: update });
      return (await db.collection(COLLECTION).findOne({ id: payload.id }, { projection: { _id: 0 } })) as PaintingTestimonial;
    }
  }

  const item: PaintingTestimonial = {
    id: payload.id || uuidv4(),
    name: payload.name,
    location: payload.location || '',
    rating: payload.rating ?? 5,
    text: payload.text,
    projectType: payload.projectType || '',
    sortOrder: payload.sortOrder ?? 0,
    active: payload.active ?? true,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(COLLECTION).insertOne(item);
  return item;
}

export async function deletePaintingTestimonial(db: Db, id: string): Promise<boolean> {
  const result = await db.collection(COLLECTION).deleteOne({ id });
  return result.deletedCount > 0;
}
