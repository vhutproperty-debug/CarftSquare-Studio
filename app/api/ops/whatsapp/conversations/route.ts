import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { logOpsActivity } from '@/lib/ops/activity/store';
import {
  getWaConversationMetrics,
  listWaConversations,
} from '@/lib/whatsapp-cloud/conversation-query';
import { syncConversationProjects } from '@/lib/whatsapp-cloud/project-tag';
import { listInboxProjects } from '@/lib/whatsapp-cloud/replies';
import { getWaDatabase } from '@/lib/whatsapp-cloud/webhook-store';
import type { WaMatchStatus } from '@/lib/whatsapp-cloud/types';

const MATCH_STATUSES: WaMatchStatus[] = [
  'unmatched',
  'matched',
  'ambiguous',
  'manually_linked',
];

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const matchStatusRaw = searchParams.get('matchStatus') || undefined;
  const matchStatus = matchStatusRaw && MATCH_STATUSES.includes(matchStatusRaw as WaMatchStatus)
    ? (matchStatusRaw as WaMatchStatus)
    : undefined;

  try {
    const db = await getWaDatabase();
    await syncConversationProjects(db);
    const project = searchParams.get('project')?.trim() || undefined;
    const [conversations, metrics, projects] = await Promise.all([
      listWaConversations(db, {
        matchStatus,
        unreadOnly: searchParams.get('unreadOnly') === 'true',
        repliedOnly: searchParams.get('replied') === 'true',
        project,
        search: searchParams.get('search') || undefined,
        limit: Number(searchParams.get('limit') || 200),
      }),
      getWaConversationMetrics(db),
      listInboxProjects(db),
    ]);

    await logOpsActivity({
      action: 'view_whatsapp_inbox',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'wa_conversations',
      details: { count: conversations.length, matchStatus: matchStatus || null, project: project || null },
      request,
    });

    return NextResponse.json({ conversations, metrics, projects });
  } catch (error) {
    console.error('[ops-whatsapp] list_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load WhatsApp conversations.' }, { status: 500 });
  }
}
