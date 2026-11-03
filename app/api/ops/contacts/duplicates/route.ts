import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { forbidUnlessOps, forbidUnlessPhase } from '@/lib/ops/os/guard';
import { canOps } from '@/lib/ops/os/permissions';
import {
  getWorkspaceDb,
  listDuplicateReviews,
  queueDuplicateReviews,
  resolveDuplicateReview,
} from '@/lib/ops/workspace/store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const closed = forbidUnlessPhase(1);
  if (closed) return closed;
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  const blocked = forbidUnlessOps(auth.admin, 'see_contact_fields');
  if (blocked) return blocked;
  const reviews = await listDuplicateReviews(await getWorkspaceDb());
  return NextResponse.json({ reviews, mergesContacts: false });
}

export async function POST(request: Request) {
  const closed = forbidUnlessPhase(1);
  if (closed) return closed;
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  const blocked = forbidUnlessOps(auth.admin, 'remark');
  if (blocked) return blocked;
  const body = await request.json().catch(() => ({})) as { action?: string; id?: string; decision?: string };
  const db = await getWorkspaceDb();
  if (body.action === 'resolve') {
    if (!canOps(auth.admin, 'remark')) {
      return NextResponse.json({ error: 'You do not have permission to review duplicates.' }, { status: 403 });
    }
    if (body.decision !== 'keep_both' && body.decision !== 'dismiss') {
      return NextResponse.json({ error: 'Choose keep both or dismiss. Contacts are not merged.' }, { status: 400 });
    }
    const review = await resolveDuplicateReview(db, String(body.id || ''), body.decision, auth.admin);
    if (!review) return NextResponse.json({ error: 'Review not found.' }, { status: 404 });
    return NextResponse.json({ review, merged: false });
  }
  const result = await queueDuplicateReviews(db, auth.admin.id);
  return NextResponse.json({ ...result, merged: false });
}
