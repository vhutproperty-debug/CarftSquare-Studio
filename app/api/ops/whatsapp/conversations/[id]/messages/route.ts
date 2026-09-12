import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { getConversationById, clearConversationUnread } from '@/lib/interakt/conversation-store';
import { listMessagesForConversation } from '@/lib/interakt/message-query';
import { getInteraktDatabase } from '@/lib/interakt/webhook-store';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const markRead = searchParams.get('markRead') !== 'false';

  try {
    const db = await getInteraktDatabase();
    const conversation = await getConversationById(db, id);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }

    const messages = await listMessagesForConversation(db, id, Number(searchParams.get('limit') || 200));
    if (markRead && conversation.unreadCount > 0) {
      await clearConversationUnread(db, id);
      conversation.unreadCount = 0;
    }

    return NextResponse.json({ conversation, messages });
  } catch (error) {
    console.error('[ops-whatsapp] messages_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load messages.' }, { status: 500 });
  }
}
