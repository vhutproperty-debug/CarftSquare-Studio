import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchEditAccess, requireResearchViewAccess } from '@/lib/research/auth';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import {
  bulkUpdateNotifications,
  countUnread,
  listNotifications,
} from '@/lib/research/monitoring/notification-store';
import type {
  AlertCategory,
  AlertSeverity,
  NotificationPriority,
} from '@/lib/research/monitoring/types';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId') || DEFAULT_RESEARCH_WORKSPACE.id;
  const readParam = searchParams.get('read');
  const archivedParam = searchParams.get('archived');
  const notifications = await listNotifications(workspaceId, {
    read: readParam == null ? undefined : readParam === 'true',
    archived: archivedParam == null ? undefined : archivedParam === 'true',
    category: (searchParams.get('category') as AlertCategory) || undefined,
    severity: (searchParams.get('severity') as AlertSeverity) || undefined,
    priority: (searchParams.get('priority') as NotificationPriority) || undefined,
    q: searchParams.get('q') || undefined,
    limit: Number(searchParams.get('limit') || 100),
  });
  const unread = await countUnread(workspaceId);
  return NextResponse.json({ ok: true, notifications, unread });
}

export async function PATCH(request: Request) {
  const auth = await requireResearchEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const body = await request.json();
    const workspaceId =
      typeof body.workspaceId === 'string'
        ? body.workspaceId
        : DEFAULT_RESEARCH_WORKSPACE.id;
    const ids = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === 'string') : [];
    const action = body.action as 'read' | 'unread' | 'archive' | 'unarchive';
    if (!ids.length || !action) {
      return NextResponse.json({ error: 'ids and action are required.' }, { status: 400 });
    }
    const modified = await bulkUpdateNotifications({ workspaceId, ids, action });
    return NextResponse.json({ ok: true, modified });
  } catch (error) {
    console.error('[research] notifications_bulk_failed', error);
    return NextResponse.json({ error: 'Bulk update failed.' }, { status: 500 });
  }
}
