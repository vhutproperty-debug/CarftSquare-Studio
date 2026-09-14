import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { getInteraktIntegrationStatus } from '@/lib/interakt/status';
import { getInteraktConversationMetrics } from '@/lib/interakt/conversation-query';
import { getInteraktDatabase } from '@/lib/interakt/webhook-store';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const status = getInteraktIntegrationStatus();
    const db = await getInteraktDatabase();
    const metrics = await getInteraktConversationMetrics(db);
    const { collectDeliveryAlerts } = await import('@/lib/interakt/delivery/alerts');
    const deliveryAlerts = await collectDeliveryAlerts(db);
    return NextResponse.json({ status, metrics, deliveryAlerts });
  } catch (error) {
    console.error('[ops-whatsapp] status_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load WhatsApp integration status.' }, { status: 500 });
  }
}
