import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchEditAccess, requireResearchViewAccess } from '@/lib/research/auth';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import {
  archiveNotification,
  getNotificationById,
  markNotificationRead,
} from '@/lib/research/monitoring/notification-store';

export const runtime = 'nodejs';
type Ctx = { params: { id: string } };

export async function GET(_request: Request, { params }: Ctx) {
  const auth = await requireResearchViewAccess(_request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  const notification = await getNotificationById(params.id);
  if (!notification) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json({ ok: true, notification });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireResearchEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const workspaceId =
    typeof body.workspaceId === 'string'
      ? body.workspaceId
      : DEFAULT_RESEARCH_WORKSPACE.id;

  if (typeof body.archived === 'boolean') {
    const notification = await archiveNotification(params.id, workspaceId, body.archived);
    if (!notification) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    return NextResponse.json({ ok: true, notification });
  }

  const notification = await markNotificationRead(
    params.id,
    workspaceId,
    body.read !== false,
  );
  if (!notification) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json({ ok: true, notification });
}
