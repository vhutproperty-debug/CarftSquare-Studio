import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { forbidUnlessPhase } from '@/lib/ops/os/guard';
import { getWorkspaceDb, workspaceSummary } from '@/lib/ops/workspace/store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const closed = forbidUnlessPhase(1);
  if (closed) return closed;
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  const summary = await workspaceSummary(await getWorkspaceDb());
  return NextResponse.json(summary);
}
