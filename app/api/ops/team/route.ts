import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { listOpsTeamMembers } from '@/lib/ops/calls/query';
import { requireOpsViewAccess } from '@/lib/ops/auth';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const members = await listOpsTeamMembers();
    return NextResponse.json({ members });
  } catch (error) {
    console.error('[ops-team] list_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load team members.' }, { status: 500 });
  }
}
