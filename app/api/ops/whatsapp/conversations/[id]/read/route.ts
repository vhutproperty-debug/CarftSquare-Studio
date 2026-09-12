import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsEditAccess } from '@/lib/ops/auth';
import { clearConversationUnread, getConversationById } from '@/lib/interakt/conversation-store';
import { getInteraktDatabase } from '@/lib/interakt/webhook-store';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const auth = await requireOpsEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { id } = await params;
  try {
    const db = await getInteraktDatabase();
    const existing = await getConversationById(db, id);
    if (!existing) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }
    await clearConversationUnread(db, id);
    const conversation = await getConversationById(db, id);
    return NextResponse.json({ conversation });
  } catch (error) {
    console.error('[ops-whatsapp] read_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to mark conversation read.' }, { status: 500 });
  }
}
