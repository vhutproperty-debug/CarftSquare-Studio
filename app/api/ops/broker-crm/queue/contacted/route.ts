import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsEditAccess } from '@/lib/ops/auth';
import { BrokerCrmValidationError } from '@/lib/ops/broker-crm/errors';
import { getBrokerCrmDatabase, markBrokerContacted } from '@/lib/ops/broker-crm/store';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await requireOpsEditAccess(request);
  if (!auth.ok) {
    return authResultToResponse(auth) ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'The update could not be read.' }, { status: 400 });
  }
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) return NextResponse.json({ error: 'A broker is required.' }, { status: 400 });

  try {
    const broker = await markBrokerContacted(await getBrokerCrmDatabase(), id);
    if (!broker) return NextResponse.json({ error: 'Broker not found.' }, { status: 404 });
    await logOpsActivity({
      action: 'update_broker_crm',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_broker_crm',
      resourceId: broker.id,
      details: { status: broker.status, queue: 'contacted' },
      request,
    });
    return NextResponse.json({ broker, sent: false });
  } catch (error) {
    if (error instanceof BrokerCrmValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[ops-broker-crm] mark_contacted_failed', error instanceof Error ? error.message : 'error');
    return NextResponse.json({ error: 'Unable to mark this broker contacted.' }, { status: 500 });
  }
}
