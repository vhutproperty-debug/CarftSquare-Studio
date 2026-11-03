import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { forbidUnlessPhase, releaseList } from '@/lib/ops/os/guard';
import { canOps } from '@/lib/ops/os/permissions';
import { createRequirement, getCrmDb, listRequirements } from '@/lib/ops/crm/requirements-store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const closed = forbidUnlessPhase(3);
  if (closed) return closed;
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!canOps(auth.admin, 'see_private_client') && !canOps(auth.admin, 'view')) {
    return NextResponse.json({ error: 'You do not have permission to view requirements.' }, { status: 403 });
  }
  const rows = await listRequirements(await getCrmDb());
  return NextResponse.json({ requirements: releaseList(auth.admin, rows, 'client') });
}

export async function POST(request: Request) {
  const closed = forbidUnlessPhase(3);
  if (closed) return closed;
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!canOps(auth.admin, 'fill_empty')) {
    return NextResponse.json({ error: 'You do not have permission to add a requirement.' }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Requirement is required.' }, { status: 400 });
  try {
    const requirement = await createRequirement(await getCrmDb(), {
      clientName: String(body.clientName || ''),
      phone: String(body.phone || ''),
      bhk: String(body.bhk || ''),
      localities: Array.isArray(body.localities) ? body.localities.map(String) : String(body.localities || '').split(',').map((item) => item.trim()),
      budgetMin: String(body.budgetMin || ''),
      budgetMax: String(body.budgetMax || ''),
      notes: String(body.notes || ''),
      assignedTo: String(body.assignedTo || auth.admin.id),
    }, auth.admin.id);
    return NextResponse.json({ requirement: releaseList(auth.admin, [requirement], 'client')[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save the requirement.' }, { status: 400 });
  }
}
