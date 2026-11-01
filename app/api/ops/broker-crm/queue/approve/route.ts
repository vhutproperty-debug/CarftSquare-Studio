import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsEditAccess } from '@/lib/ops/auth';
import { BrokerCrmPrivacyError } from '@/lib/ops/broker-crm/privacy';
import { approveBrokerCrmWave, getBrokerCrmDatabase } from '@/lib/ops/broker-crm/store';
import { parseWaveId, WAVE_SENDS_WHATSAPP, type WaveTemplateInput } from '@/lib/ops/broker-crm/waves';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  const auth = await requireOpsEditAccess(request);
  if (!auth.ok) {
    return authResultToResponse(auth) ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { wave?: unknown; template?: WaveTemplateInput | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'The approval could not be read.' }, { status: 400 });
  }
  const wave = parseWaveId(body.wave);
  if (!wave) return NextResponse.json({ error: 'Choose wave 1, 2, or 3.' }, { status: 400 });

  try {
    const result = await approveBrokerCrmWave(await getBrokerCrmDatabase(), {
      wave,
      approvedById: auth.admin.id,
      approvedByEmail: auth.admin.email,
      template: body.template || null,
    });
    await logOpsActivity({
      action: 'approve_broker_crm_wave',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_broker_crm_queue',
      resourceId: result.approval.id,
      details: {
        wave,
        recipientCount: result.recipientCount,
        sent: WAVE_SENDS_WHATSAPP,
      },
      request,
    });
    return NextResponse.json({
      approval: result.approval,
      sent: false,
      message: 'Wave approved and logged. No WhatsApp message was sent.',
    });
  } catch (error) {
    if (error instanceof BrokerCrmPrivacyError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[ops-broker-crm] wave_approve_failed', error instanceof Error ? error.message : 'error');
    return NextResponse.json({ error: 'Unable to approve this wave.' }, { status: 500 });
  }
}
