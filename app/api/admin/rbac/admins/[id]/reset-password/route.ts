import { NextResponse } from 'next/server';
import { getDatabase, resetAdminPassword } from '@/lib/auth/rbac/store';
import { logAuditEvent } from '@/lib/auth/rbac/audit';
import { resetAdminPasswordSchema } from '@/lib/auth/rbac/schemas';
import { authorizeRequest } from '@/lib/auth/require-admin-api';
import { authResultToResponse } from '@/lib/auth/rbac/guard';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { id: string } };

export async function POST(request: Request, { params }: RouteContext) {
  const auth = await authorizeRequest(request, { permission: 'super_admin' });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const body = await request.json();
  const parsed = resetAdminPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = await getDatabase();
  const updated = await resetAdminPassword(db, params.id, parsed.data.password);
  if (!updated) return NextResponse.json({ error: 'Admin not found.' }, { status: 404 });

  await logAuditEvent(db, 'reset_password', {
    request,
    actorId: auth.admin.id,
    actorEmail: auth.admin.email,
  }, 'admin', { resourceId: params.id });

  return NextResponse.json({ success: true, message: 'Password reset successfully.' });
}
