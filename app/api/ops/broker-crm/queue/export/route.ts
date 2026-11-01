import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsEditAccess } from '@/lib/ops/auth';
import { BrokerCrmPrivacyError } from '@/lib/ops/broker-crm/privacy';
import { getBrokerCrmDatabase, loadBrokerCrmRecords } from '@/lib/ops/broker-crm/store';
import {
  buildWhatsAppPriorityQueue,
  parseWaveId,
  renderWaveCsv,
  type WaveTemplateInput,
} from '@/lib/ops/broker-crm/waves';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const auth = await requireOpsEditAccess(request);
  if (!auth.ok) {
    return authResultToResponse(auth) ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const wave = parseWaveId(url.searchParams.get('wave'));
  if (!wave) return NextResponse.json({ error: 'Choose wave 1, 2, or 3.' }, { status: 400 });

  const template: WaveTemplateInput | null = url.searchParams.get('template') === '1'
    ? {
      bhk: url.searchParams.get('bhk'),
      floorBand: url.searchParams.get('floorBand'),
      furnishing: url.searchParams.get('furnishing'),
      project: url.searchParams.get('project'),
    }
    : null;

  try {
    const queue = buildWhatsAppPriorityQueue(await loadBrokerCrmRecords(await getBrokerCrmDatabase()));
    const csv = renderWaveCsv(queue.waves[wave], template);
    await logOpsActivity({
      action: 'export_broker_crm_wave',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_broker_crm_queue',
      details: { wave, recipients: queue.counts[wave], sent: false },
      request,
    });
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="broker-crm-wave-${wave}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof BrokerCrmPrivacyError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[ops-broker-crm] wave_export_failed', error instanceof Error ? error.message : 'error');
    return NextResponse.json({ error: 'Unable to export this wave.' }, { status: 500 });
  }
}
