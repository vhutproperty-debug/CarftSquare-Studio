import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { getBrokerCrmDatabase, queueBrokerCrm } from '@/lib/ops/broker-crm/store';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  if (!auth.ok) {
    return authResultToResponse(auth) ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const queue = await queueBrokerCrm(await getBrokerCrmDatabase());
    await logOpsActivity({
      action: 'view_broker_crm_queue',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_broker_crm_queue',
      details: {
        wave1: queue.counts[1],
        wave2: queue.counts[2],
        wave3: queue.counts[3],
        excludedDoNotContact: queue.excludedDoNotContact,
      },
      request,
    });
    return NextResponse.json(queue);
  } catch (error) {
    console.error('[ops-broker-crm] queue_failed', error instanceof Error ? error.message : 'error');
    return NextResponse.json({ error: 'Unable to load the priority queue.' }, { status: 500 });
  }
}
