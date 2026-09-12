import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { getConversationById } from '@/lib/interakt/conversation-store';
import { getInteraktDatabase } from '@/lib/interakt/webhook-store';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { id } = await params;
  try {
    const db = await getInteraktDatabase();
    const conversation = await getConversationById(db, id);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }
    return NextResponse.json({ conversation });
  } catch (error) {
    console.error('[ops-whatsapp] detail_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load conversation.' }, { status: 500 });
  }
}
