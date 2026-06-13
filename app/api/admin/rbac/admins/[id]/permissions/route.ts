import { NextResponse } from 'next/server';
import { assignAdminPermissions, getDatabase } from '@/lib/auth/rbac/store';
import { logAuditEvent } from '@/lib/auth/rbac/audit';
import { assignPermissionsSchema } from '@/lib/auth/rbac/schemas';
import { authorizeRequest } from '@/lib/auth/require-admin-api';
import { authResultToResponse } from '@/lib/auth/rbac/guard';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { id: string } };

export async function PUT(request: Request, { params }: RouteContext) {
  const auth = await authorizeRequest(request, { permission: 'super_admin' });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const body = await request.json();
  const parsed = assignPermissionsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = await getDatabase();
  const updated = await assignAdminPermissions(db, params.id, parsed.data.permissions);
  if (!updated) {
    return NextResponse.json({ error: 'Admin not found or permissions cannot be changed.' }, { status: 403 });
  }

  await logAuditEvent(db, 'permission_change', {
    request,
    actorId: auth.admin.id,
    actorEmail: auth.admin.email,
  }, 'admin', {
    module: 'admin',
    resourceId: params.id,
    details: { permissions: parsed.data.permissions },
  });

  return NextResponse.json({ admin: updated });
}
