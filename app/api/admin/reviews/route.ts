import { NextResponse } from 'next/server';
import { authorizeRequest } from '@/lib/auth/require-admin-api';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { PERMISSIONS } from '@/lib/auth/rbac/permissions';
import { logAuditEvent } from '@/lib/auth/rbac/audit';
import { getDatabase } from '@/lib/auth/rbac/store';
import {
  createReview,
  deleteReview,
  ensureReviewIndexes,
  listAllReviews,
  updateReview,
} from '@/lib/reviews/store';
import { reviewCreateSchema, reviewDeleteSchema, reviewUpdateSchema } from '@/lib/reviews/schemas';
import type { ReviewStatus } from '@/lib/reviews/types';

const VALID_STATUSES: ReviewStatus[] = ['pending', 'approved', 'rejected'];

function guard(request: Request) {
  return authorizeRequest(request, { permission: PERMISSIONS.REVIEWS });
}

export async function GET(request: Request) {
  const auth = await guard(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

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
  const auth = await guard(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const body = await request.json();
  const parsed = reviewCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const db = await getDatabase();
  await ensureReviewIndexes(db);
  const review = await createReview(db, parsed.data);

  await logAuditEvent(db, 'create', {
    request,
    actorId: auth.admin.id,
    actorEmail: auth.admin.email,
  }, 'review', { resourceId: review.id });

  return NextResponse.json({ review }, { status: 201 });
}

export async function PUT(request: Request) {
  const auth = await guard(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const body = await request.json();
  const parsed = reviewUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const db = await getDatabase();
  const updated = await updateReview(db, parsed.data.id, parsed.data);
  if (!updated) return NextResponse.json({ error: 'Review not found' }, { status: 404 });

  await logAuditEvent(db, 'edit', {
    request,
    actorId: auth.admin.id,
    actorEmail: auth.admin.email,
  }, 'review', { resourceId: parsed.data.id });

  return NextResponse.json({ review: updated });
}

export async function DELETE(request: Request) {
  const auth = await guard(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const body = await request.json();
  const parsed = reviewDeleteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const db = await getDatabase();
  const removed = await deleteReview(db, parsed.data.id);
  if (!removed) return NextResponse.json({ error: 'Review not found' }, { status: 404 });

  await logAuditEvent(db, 'delete', {
    request,
    actorId: auth.admin.id,
    actorEmail: auth.admin.email,
  }, 'review', { resourceId: parsed.data.id });

  return NextResponse.json({ success: true });
}
