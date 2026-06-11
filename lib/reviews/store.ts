import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
// @ts-expect-error JS module without types
import { getDb } from '@/lib/mongodb';
import type { CustomerReview, ReviewStatus } from './types';

const COLLECTION = 'customer_reviews';

export async function getDatabase(): Promise<Db> {
  return getDb();
}

export async function ensureReviewIndexes(db: Db): Promise<void> {
  await db.collection(COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ status: 1 });
  await db.collection(COLLECTION).createIndex({ createdAt: -1 });
  await db.collection(COLLECTION).createIndex({ rating: -1 });
}

export async function listApprovedReviews(db: Db, limit = 12): Promise<CustomerReview[]> {
  return db
    .collection(COLLECTION)
    .find({ status: 'approved' }, { projection: { _id: 0 } })
    .sort({ approvedAt: -1, createdAt: -1 })
    .limit(limit)
    .toArray() as Promise<CustomerReview[]>;
}

export async function listAllReviews(
  db: Db,
  filters: { status?: ReviewStatus; q?: string } = {},
): Promise<CustomerReview[]> {
  const query: Record<string, unknown> = {};
  if (filters.status) query.status = filters.status;

  let reviews = (await db
    .collection(COLLECTION)
    .find(query, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray()) as CustomerReview[];

  const q = filters.q?.trim().toLowerCase();
  if (q) {
    reviews = reviews.filter((r) =>
      [r.customerName, r.projectType, r.reviewText, r.area].join(' ').toLowerCase().includes(q),
    );
  }
  return reviews;
}

export async function createReview(
  db: Db,
  payload: Omit<CustomerReview, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'approvedAt'>,
): Promise<CustomerReview> {
  const now = new Date().toISOString();
  const review: CustomerReview = {
    ...payload,
    id: uuidv4(),
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(COLLECTION).insertOne(review);
  return review;
}

export async function updateReview(db: Db, id: string, patch: Partial<CustomerReview>): Promise<CustomerReview | null> {
  const now = new Date().toISOString();
  const update: Partial<CustomerReview> = { ...patch, updatedAt: now };
  if (patch.status === 'approved') update.approvedAt = now;
  if (patch.status === 'rejected' || patch.status === 'pending') {
    update.approvedAt = undefined;
  }
  await db.collection(COLLECTION).updateOne({ id }, { $set: update });
  return db.collection(COLLECTION).findOne({ id }, { projection: { _id: 0 } }) as Promise<CustomerReview | null>;
}

export async function deleteReview(db: Db, id: string): Promise<boolean> {
  const result = await db.collection(COLLECTION).deleteOne({ id });
  return result.deletedCount > 0;
}

export type PublicReviewCard = Pick<
  CustomerReview,
  'customerName' | 'projectType' | 'rating' | 'reviewText' | 'area' | 'images'
>;

export function toPublicReviewCards(reviews: CustomerReview[]): PublicReviewCard[] {
  return reviews.map(({ customerName, projectType, rating, reviewText, area, images }) => ({
    customerName,
    projectType,
    rating,
    reviewText,
    area: area || '',
    images: images || [],
  }));
}
