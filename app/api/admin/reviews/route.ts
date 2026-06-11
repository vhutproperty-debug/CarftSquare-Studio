import { NextResponse } from 'next/server';
import { requireAdminFromRequest } from '@/lib/auth/require-admin-api';
import { reviewCreateSchema, reviewDeleteSchema, reviewUpdateSchema } from '@/lib/reviews/schemas';
import {
  createReview,
  deleteReview,
  ensureReviewIndexes,
  getDatabase,
  listAllReviews,
  updateReview,
} from '@/lib/reviews/store';
import type { ReviewStatus } from '@/lib/reviews/types';

const VALID_STATUSES: ReviewStatus[] = ['pending', 'approved', 'rejected'];

export async function GET(request: Request) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get('status') || undefined;
  const status = statusParam && VALID_STATUSES.includes(statusParam as ReviewStatus)
    ? (statusParam as ReviewStatus)
    : undefined;
  const q = searchParams.get('q') || undefined;

  const db = await getDatabase();
  await ensureReviewIndexes(db);
  const reviews = await listAllReviews(db, { status, q });
  return NextResponse.json({ reviews });
}

export async function POST(request: Request) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });

  const body = await request.json();
  const parsed = reviewCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const db = await getDatabase();
  await ensureReviewIndexes(db);
  const review = await createReview(db, parsed.data);
  return NextResponse.json({ review }, { status: 201 });
}

export async function PUT(request: Request) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });

  const body = await request.json();
  const parsed = reviewUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const db = await getDatabase();
  const updated = await updateReview(db, parsed.data.id, parsed.data);
  if (!updated) return NextResponse.json({ error: 'Review not found' }, { status: 404 });
  return NextResponse.json({ review: updated });
}

export async function DELETE(request: Request) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });

  const body = await request.json();
  const parsed = reviewDeleteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const db = await getDatabase();
  const removed = await deleteReview(db, parsed.data.id);
  if (!removed) return NextResponse.json({ error: 'Review not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
