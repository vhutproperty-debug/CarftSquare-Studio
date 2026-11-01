import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsEditAccess } from '@/lib/ops/auth';
import { BrokerCrmParseError } from '@/lib/ops/broker-crm/errors';
import { parseBrokerCrmFile } from '@/lib/ops/broker-crm/parse';
import { getBrokerCrmDatabase, importBrokerCrmRows } from '@/lib/ops/broker-crm/store';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await requireOpsEditAccess(request);
  if (!auth.ok) {
    return authResultToResponse(auth) ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Choose a .xlsx or .csv file.' }, { status: 400 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const rows = parseBrokerCrmFile(file.name || 'brokers.xlsx', bytes);
    const stats = await importBrokerCrmRows(await getBrokerCrmDatabase(), rows);
    await logOpsActivity({
      action: 'import_broker_crm',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_broker_crm',
      details: {
        rows: stats.rows,
        created: stats.created,
        updated: stats.updated,
        unchanged: stats.unchanged,
        skipped: stats.skipped,
        dedupedInFile: stats.dedupedInFile,
      },
      request,
    });
    return NextResponse.json({ stats });
  } catch (error) {
    if (error instanceof BrokerCrmParseError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[ops-broker-crm] import_failed', error instanceof Error ? error.message : 'error');
    return NextResponse.json({ error: 'Unable to import brokers.' }, { status: 500 });
  }
}
