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

  const db = await getDatabase();
  const updated = await setAdminStatus(db, params.id, ADMIN_STATUSES.ACTIVE);
  if (!updated) return NextResponse.json({ error: 'Admin not found.' }, { status: 404 });

  await logAuditEvent(db, 'activation', {
    request,
    actorId: auth.admin.id,
    actorEmail: auth.admin.email,
  }, 'admin', { module: 'admin', resourceId: params.id });

  return NextResponse.json({ admin: updated });
}
