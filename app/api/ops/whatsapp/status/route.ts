import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { buildWhatsAppHealth } from '@/lib/whatsapp-cloud/status';
import { getWaConversationMetrics } from '@/lib/whatsapp-cloud/conversation-query';
import { getWaDatabase } from '@/lib/whatsapp-cloud/webhook-store';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const db = await getWaDatabase();
    const status = await buildWhatsAppHealth(db);
    const metrics = await getWaConversationMetrics(db);
    const { collectDeliveryAlerts } = await import('@/lib/whatsapp-cloud/delivery/alerts');
    const deliveryAlerts = await collectDeliveryAlerts(db);
    return NextResponse.json({ status, metrics, deliveryAlerts });
  } catch (error) {
    console.error('[ops-whatsapp] status_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load WhatsApp integration status.' }, { status: 500 });
  }
}
