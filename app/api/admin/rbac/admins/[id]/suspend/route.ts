import { NextResponse } from 'next/server';
import { getDatabase, setAdminStatus } from '@/lib/auth/rbac/store';
import { logAuditEvent } from '@/lib/auth/rbac/audit';
import { authorizeRequest } from '@/lib/auth/require-admin-api';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { ADMIN_STATUSES } from '@/lib/auth/rbac/roles';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { id: string } };

export async function POST(request: Request, { params }: RouteContext) {
  const auth = await authorizeRequest(request, { permission: 'super_admin' });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  if (params.id === auth.admin.id) {
    return NextResponse.json({ error: 'You cannot suspend your own account.' }, { status: 403 });
  }

  const db = await getDatabase();
  const updated = await setAdminStatus(db, params.id, ADMIN_STATUSES.SUSPENDED);
  if (!updated) {
    return NextResponse.json({ error: 'Admin not found or cannot be suspended.' }, { status: 403 });
  }

  await logAuditEvent(db, 'suspension', {
    request,
    actorId: auth.admin.id,
    actorEmail: auth.admin.email,
  }, 'admin', { module: 'admin', resourceId: params.id });

  return NextResponse.json({ admin: updated });
}
