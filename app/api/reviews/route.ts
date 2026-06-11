import { NextResponse } from 'next/server';
import { reviewPublicSubmitSchema } from '@/lib/reviews/schemas';
import {
  createReview,
  ensureReviewIndexes,
  getDatabase,
  listApprovedReviews,
  toPublicReviewCards,
} from '@/lib/reviews/store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Public read — approved reviews only. Never exposes pending or rejected. */
export async function GET() {
  try {
    const db = await getDatabase();
    await ensureReviewIndexes(db);
    const reviews = await listApprovedReviews(db, 12);
    return NextResponse.json({ reviews: toPublicReviewCards(reviews) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load reviews' }, { status: 500 });
  }
}

/** Public write — always saved as pending. Never published immediately. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = reviewPublicSubmitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const db = await getDatabase();
    await ensureReviewIndexes(db);
    await createReview(db, parsed.data);

    return NextResponse.json(
      {
        success: true,
        message: 'Thank you! Your review has been submitted and will appear on our website after admin approval.',
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit review' },
      { status: 500 },
    );
  }
}
