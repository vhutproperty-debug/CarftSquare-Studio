import { NextResponse } from 'next/server';
import { getDatabase, listAuditLogs } from '@/lib/auth/rbac/store';
import { authorizeRequest } from '@/lib/auth/require-admin-api';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import type { AuditAction } from '@/lib/auth/rbac/types';

export const dynamic = 'force-dynamic';

const VALID_ACTIONS: AuditAction[] = [
  'login',
  'logout',
  'create',
  'edit',
  'delete',
  'publish',
  'archive',
  'suspend',
  'activate',
  'reset_password',
  'assign_permissions',
  'permission_change',
  'admin_creation',
  'admin_deletion',
  'suspension',
  'activation',
];

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, { permission: 'super_admin' });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const actorId = searchParams.get('actorId') || undefined;
  const actionParam = searchParams.get('action') || undefined;
  const action = actionParam && VALID_ACTIONS.includes(actionParam as AuditAction)
    ? (actionParam as AuditAction)
    : undefined;
  const moduleFilter = searchParams.get('module') || undefined;
  const q = searchParams.get('q') || undefined;
  const limit = Number(searchParams.get('limit') || '100');

  const db = await getDatabase();
  const logs = await listAuditLogs(db, {
    actorId,
    action,
    module: moduleFilter as never,
    q,
    limit,
  });
  return NextResponse.json({ logs });
}
