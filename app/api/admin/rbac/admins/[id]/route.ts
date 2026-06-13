import { NextResponse } from 'next/server';
import {
  deleteAdmin,
  findAdminById,
  getDatabase,
  toPublicAdmin,
  updateAdmin,
} from '@/lib/auth/rbac/store';
import { logAuditEvent } from '@/lib/auth/rbac/audit';
import { updateAdminSchema } from '@/lib/auth/rbac/schemas';
import { authorizeRequest } from '@/lib/auth/require-admin-api';
import { authResultToResponse } from '@/lib/auth/rbac/guard';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { id: string } };

export async function GET(request: Request, { params }: RouteContext) {
  const auth = await authorizeRequest(request, { permission: 'super_admin' });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const db = await getDatabase();
  const admin = toPublicAdmin(await findAdminById(db, params.id));
  if (!admin) return NextResponse.json({ error: 'Admin not found.' }, { status: 404 });
  return NextResponse.json({ admin });
}

export async function PUT(request: Request, { params }: RouteContext) {
  const auth = await authorizeRequest(request, { permission: 'super_admin' });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const body = await request.json();
  const parsed = updateAdminSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = await getDatabase();
  const updated = await updateAdmin(db, params.id, parsed.data);
  if (!updated) return NextResponse.json({ error: 'Admin not found.' }, { status: 404 });

  await logAuditEvent(db, 'edit', {
    request,
    actorId: auth.admin.id,
    actorEmail: auth.admin.email,
  }, 'admin', {
    resourceId: params.id,
    details: parsed.data,
  });

  return NextResponse.json({ admin: updated });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const auth = await authorizeRequest(request, { permission: 'super_admin' });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  if (params.id === auth.admin.id) {
    return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 403 });
  }

  const db = await getDatabase();
  const result = await deleteAdmin(db, params.id);

  if (!result.deleted) {
    if (result.reason === 'super_admin_protected') {
      return NextResponse.json({ error: 'Super Admin accounts cannot be deleted.' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Admin not found.' }, { status: 404 });
  }

  await logAuditEvent(db, 'admin_deletion', {
    request,
    actorId: auth.admin.id,
    actorEmail: auth.admin.email,
  }, 'admin', { module: 'admin', resourceId: params.id });

  return NextResponse.json({ success: true });
}
