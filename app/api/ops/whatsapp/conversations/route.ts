import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { logOpsActivity } from '@/lib/ops/activity/store';
import {
  getInteraktConversationMetrics,
  listInteraktConversations,
} from '@/lib/interakt/conversation-query';
import { getInteraktDatabase } from '@/lib/interakt/webhook-store';
import type { InteraktMatchStatus } from '@/lib/interakt/types';

const MATCH_STATUSES: InteraktMatchStatus[] = [
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
  const matchStatus = matchStatusRaw && MATCH_STATUSES.includes(matchStatusRaw as InteraktMatchStatus)
    ? (matchStatusRaw as InteraktMatchStatus)
    : undefined;

  try {
    const db = await getInteraktDatabase();
    const [conversations, metrics] = await Promise.all([
      listInteraktConversations(db, {
        matchStatus,
        unreadOnly: searchParams.get('unreadOnly') === 'true',
        search: searchParams.get('search') || undefined,
        limit: Number(searchParams.get('limit') || 200),
      }),
      getInteraktConversationMetrics(db),
    ]);

    await logOpsActivity({
      action: 'view_whatsapp_inbox',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'interakt_conversations',
      details: { count: conversations.length, matchStatus: matchStatus || null },
      request,
    });

    return NextResponse.json({ conversations, metrics });
  } catch (error) {
    console.error('[ops-whatsapp] list_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load WhatsApp conversations.' }, { status: 500 });
  }
}
