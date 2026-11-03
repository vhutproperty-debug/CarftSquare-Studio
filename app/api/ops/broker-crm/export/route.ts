import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { forbidUnlessOps } from '@/lib/ops/os/guard';
import { isDoNotContact, outreachCsvFor, selectOutreachRecipients } from '@/lib/ops/broker-crm/privacy';
import { getBrokerCrmDatabase, loadBrokerCrmRecords } from '@/lib/ops/broker-crm/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  if (!auth.ok) {
    return authResultToResponse(auth) ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const blocked = forbidUnlessOps(auth.admin, 'export');
  if (blocked) return blocked;

  try {
    const records = await loadBrokerCrmRecords(await getBrokerCrmDatabase());
    const csv = outreachCsvFor(records);
    const recipients = selectOutreachRecipients(records).length;
    await logOpsActivity({
      action: 'export_broker_crm_outreach',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_broker_crm',
      details: {
        recipients,
        excludedDoNotContact: records.filter((record) => isDoNotContact(record)).length,
      },
      request,
    });
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="broker-crm-outreach.csv"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[ops-broker-crm] export_failed', error instanceof Error ? error.message : 'error');
    return NextResponse.json({ error: 'Unable to build the outreach export.' }, { status: 500 });
  }
}
