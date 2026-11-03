import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { forbidUnlessOps, forbidUnlessPhase } from '@/lib/ops/os/guard';
import { canOps } from '@/lib/ops/os/permissions';
import { getWorkspaceDb, listAgreementTerms, saveAgreementTerms } from '@/lib/ops/workspace/store';

export const dynamic = 'force-dynamic';

function numberOrNull(value: unknown): number | null | undefined {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed;
}

export async function GET(request: Request) {
  const closed = forbidUnlessPhase(1);
  if (closed) return closed;
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  const blocked = forbidUnlessOps(auth.admin, 'view');
  if (blocked) return blocked;
  const terms = await listAgreementTerms(await getWorkspaceDb());
  return NextResponse.json({ terms });
}

export async function POST(request: Request) {
  const closed = forbidUnlessPhase(1);
  if (closed) return closed;
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!canOps(auth.admin, 'fill_empty') && !canOps(auth.admin, 'edit')) {
    return NextResponse.json({ error: 'You do not have permission to save agreement terms.' }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Agreement terms are required.' }, { status: 400 });
  const lockInMonths = numberOrNull(body.lockInMonths);
  const noticeDays = numberOrNull(body.noticeDays);
  if (lockInMonths === undefined || noticeDays === undefined) {
    return NextResponse.json({ error: 'Lock-in and notice must be zero or a positive number of months or days.' }, { status: 400 });
  }
  try {
    const terms = await saveAgreementTerms(await getWorkspaceDb(), {
      agreementId: String(body.agreementId || ''),
      rent: body.rent != null ? String(body.rent) : undefined,
      deposit: body.deposit != null ? String(body.deposit) : undefined,
      lockInMonths,
      noticeDays,
    }, auth.admin.id);
    return NextResponse.json({ terms });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save terms.' }, { status: 400 });
  }
}
