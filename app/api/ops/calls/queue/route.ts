import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { callQueueQuerySchema } from '@/lib/ops/calls/schemas';
import {
  buildCallQueueItems,
  sectionizeCallQueue,
} from '@/lib/ops/calls/query';
import { getDatabase } from '@/lib/ops/calls/activity-store';
import type { CallDisplayStatus } from '@/lib/ops/calls/statuses';
import { isCallDisplayStatus } from '@/lib/ops/calls/statuses';
import { requireOpsViewAccess } from '@/lib/ops/auth';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const parsed = callQueueQuerySchema.safeParse({
    section: searchParams.get('section') || 'all',
    assignedTo: searchParams.get('assignedTo') || undefined,
    project: searchParams.get('project') || undefined,
    prospectType: searchParams.get('prospectType') || undefined,
    callStatus: searchParams.get('callStatus') || undefined,
    search: searchParams.get('search') || undefined,
    mineOnly: searchParams.get('mineOnly') || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const db = await getDatabase();
    const filters = parsed.data;
    const callStatus = filters.callStatus && isCallDisplayStatus(filters.callStatus)
      ? filters.callStatus as CallDisplayStatus
      : undefined;

    const items = await buildCallQueueItems(db, auth.admin, {
      assignedTo: filters.assignedTo,
      project: filters.project,
      prospectType: filters.prospectType,
      callStatus,
      search: filters.search,
      mineOnly: filters.mineOnly,
    });

    const sections = sectionizeCallQueue(items, auth.admin.id);
    const activeSection = sections.find((section) => section.id === filters.section);
    const visibleItems = filters.section === 'all'
      ? items.slice(0, 100)
      : activeSection?.items || [];

    return NextResponse.json({
      items: visibleItems,
      sections: sections.map((section) => ({
        id: section.id,
        label: section.label,
        count: section.items.length,
      })),
      total: items.length,
    });
  } catch (error) {
    console.error('[ops-calls] queue_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load call queue.' }, { status: 500 });
  }
}
