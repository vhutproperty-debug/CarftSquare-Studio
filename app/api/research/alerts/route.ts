import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchViewAccess } from '@/lib/research/auth';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import { listNotifications } from '@/lib/research/monitoring/notification-store';
import type { AlertCategory, AlertSeverity } from '@/lib/research/monitoring/types';

export const runtime = 'nodejs';

/** Alias of notifications filtered to non-insight market alerts. */
export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId') || DEFAULT_RESEARCH_WORKSPACE.id;
  const alerts = await listNotifications(workspaceId, {
    category: (searchParams.get('category') as AlertCategory) || undefined,
    severity: (searchParams.get('severity') as AlertSeverity) || undefined,
    q: searchParams.get('q') || undefined,
    archived: searchParams.get('archived') === 'true' ? true : false,
    limit: Number(searchParams.get('limit') || 100),
  });
  return NextResponse.json({
    ok: true,
    alerts: alerts.filter((a) => a.category !== 'insight'),
  });
}
