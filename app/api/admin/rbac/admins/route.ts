import { NextResponse } from 'next/server';
import { createAdmin, getDatabase, listAdmins } from '@/lib/auth/rbac/store';
import { logAuditEvent } from '@/lib/auth/rbac/audit';
import { createAdminSchema } from '@/lib/auth/rbac/schemas';
import { authorizeRequest } from '@/lib/auth/require-admin-api';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import {
  ACTION_KEYS,
  ACTION_LABELS,
  MODULE_KEYS,
  MODULE_LABELS,
} from '@/lib/auth/rbac/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, { permission: 'super_admin' });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || undefined;
  const status = (searchParams.get('status') || 'all') as 'active' | 'suspended' | 'all';

  const db = await getDatabase();
  const admins = await listAdmins(db, { q, status });
  return NextResponse.json({
    admins,
    catalog: {
      modules: MODULE_KEYS.map((key) => ({ key, label: MODULE_LABELS[key] })),
      actions: ACTION_KEYS.map((key) => ({ key, label: ACTION_LABELS[key] })),
    },
  });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, { permission: 'super_admin' });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const body = await request.json();
  const parsed = createAdminSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = await getDatabase();
  try {
    const admin = await createAdmin(db, {
      ...parsed.data,
      createdBy: auth.admin.id,
    });

    await logAuditEvent(db, 'admin_creation', {
      request,
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
    }, 'admin', {
      module: 'admin',
      resourceId: admin.id,
      details: { email: admin.email, permissions: admin.permissions },
    });

    return NextResponse.json({ admin }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create admin.';
    if (/duplicate key/i.test(message)) {
      return NextResponse.json({ error: 'An admin with this email already exists.' }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
