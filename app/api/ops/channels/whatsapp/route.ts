import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { ChannelSafetyError, assertOsWhatsAppSendAllowed } from '@/lib/ops/channels/safety';
import { forbidUnlessPhase } from '@/lib/ops/os/guard';
import { getDb } from '@/lib/mongodb';
import { isWhatsAppSendingPaused } from '@/lib/whatsapp-cloud/send-policy';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const closed = forbidUnlessPhase(6);
  if (closed) return closed;
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  const db = await getDb();
  const paused = await isWhatsAppSendingPaused(db);
  try {
    assertOsWhatsAppSendAllowed(paused);
  } catch (error) {
    const status = error instanceof ChannelSafetyError ? error.status : 409;
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'WhatsApp sending is paused.',
      sent: false,
    }, { status });
  }
  return NextResponse.json({
    sent: false,
    allowed: true,
    message: 'Sending stays on the existing WhatsApp inbox, which uses the same restricted-account check.',
  });
}
