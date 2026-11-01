import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsEditAccess, requireOpsViewAccess } from '@/lib/ops/auth';
import { BrokerCrmValidationError } from '@/lib/ops/broker-crm/errors';
import type { BrokerCrmPatch } from '@/lib/ops/broker-crm/patch';
import { BrokerCrmPrivacyError } from '@/lib/ops/broker-crm/privacy';
import { getBrokerCrm, getBrokerCrmDatabase, updateBrokerCrm } from '@/lib/ops/broker-crm/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RouteContext = { params: { id: string } };

export async function GET(request: Request, { params }: RouteContext) {
  const auth = await requireOpsViewAccess(request);
  if (!auth.ok) {
    return authResultToResponse(auth) ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const record = await getBrokerCrm(await getBrokerCrmDatabase(), params.id);
    if (!record) return NextResponse.json({ error: 'Broker not found.' }, { status: 404 });
    await logOpsActivity({
      action: 'view_broker_crm_detail',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_broker_crm',
      resourceId: record.id,
      details: { status: record.status },
      request,
    });
    return NextResponse.json({ broker: record });
  } catch (error) {
    console.error('[ops-broker-crm] detail_failed', error instanceof Error ? error.message : 'error');
    return NextResponse.json({ error: 'Unable to load this broker.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireOpsEditAccess(request);
  if (!auth.ok) {
    return authResultToResponse(auth) ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: BrokerCrmPatch;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'The update could not be read.' }, { status: 400 });
  }

  try {
    const broker = await updateBrokerCrm(await getBrokerCrmDatabase(), params.id, body);
    if (!broker) return NextResponse.json({ error: 'Broker not found.' }, { status: 404 });
    await logOpsActivity({
      action: 'update_broker_crm',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_broker_crm',
      resourceId: broker.id,
      details: { status: broker.status, doNotContact: broker.doNotContact },
      request,
    });
    return NextResponse.json({ broker });
  } catch (error) {
    if (error instanceof BrokerCrmValidationError || error instanceof BrokerCrmPrivacyError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[ops-broker-crm] update_failed', error instanceof Error ? error.message : 'error');
    return NextResponse.json({ error: 'Unable to save this broker.' }, { status: 500 });
  }
}
