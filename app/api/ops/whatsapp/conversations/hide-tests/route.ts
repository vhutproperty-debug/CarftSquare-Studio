import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsEditAccess } from '@/lib/ops/auth';
import { hideUnmatchedConversations } from '@/lib/whatsapp-cloud/conversation-store';
import { getWaDatabase } from '@/lib/whatsapp-cloud/webhook-store';

export async function POST(request: Request) {
  const auth = await requireOpsEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  try {
    const db = await getWaDatabase();
    const hidden = await hideUnmatchedConversations(db);
    return NextResponse.json({ ok: true, hidden });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unable to hide test threads.',
    }, { status: 500 });
  }
}
