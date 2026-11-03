import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { isSuperAdmin } from '@/lib/auth/rbac/roles';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { ChannelSafetyError } from '@/lib/ops/channels/safety';
import {
  approveFollowUpBatch,
  getFollowUpGrowthDb,
  listFollowUpBatches,
  listGrowthTemplates,
  recordFollowUpDelivery,
  scheduleFollowUp,
  sendFollowUpBatch,
  syncApprovedTemplates,
  type DeliveryStatus,
} from '@/lib/ops/growth/followup/store';
import { forbidBrokerGrowth, forbidUnlessGrowth } from '@/lib/ops/os/guard';
import { getWhatsAppSendDecision } from '@/lib/whatsapp-cloud/send-policy';
import { listTemplates } from '@/lib/whatsapp-cloud/client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const closed = forbidUnlessGrowth('FOLLOWUP');
  if (closed) return closed;
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  const broker = forbidBrokerGrowth(auth.admin);
  if (broker) return broker;
  const db = await getFollowUpGrowthDb();
  const [templates, batches, decision] = await Promise.all([
    listGrowthTemplates(db),
    listFollowUpBatches(db),
    getWhatsAppSendDecision(db),
  ]);
  return NextResponse.json({
    templates,
    batches,
    sendingBlocked: decision.blocked,
    sendBlockReason: decision.reason,
    canApprove: isSuperAdmin(auth.admin),
  });
}

export async function POST(request: Request) {
  const closed = forbidUnlessGrowth('FOLLOWUP');
  if (closed) return closed;
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  const broker = forbidBrokerGrowth(auth.admin);
  if (broker) return broker;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Follow-up payload is required.' }, { status: 400 });
  const db = await getFollowUpGrowthDb();
  const actor = { id: auth.admin.id, email: auth.admin.email };
  try {
    if (body.action === 'sync') {
      let remote: Array<{ name?: string; language?: string; status?: string; id?: string }> = [];
      let warning = '';
      try {
        remote = await listTemplates();
      } catch (error) {
        warning = error instanceof Error ? error.message : 'Meta template sync is unavailable.';
      }
      const synced = await syncApprovedTemplates(db, remote);
      return NextResponse.json({ ...synced, warning });
    }
    if (body.action === 'schedule') {
      const recipients = Array.isArray(body.recipients) ? body.recipients as Array<{ phone?: string; leadId?: string }> : [];
      const batch = await scheduleFollowUp(db, {
        templateName: String(body.templateName || ''),
        languageCode: body.languageCode ? String(body.languageCode) : undefined,
        scheduledFor: String(body.scheduledFor || ''),
        recipients: recipients.map((row) => ({ phone: String(row.phone || ''), leadId: String(row.leadId || '') })),
      }, auth.admin.id);
      return NextResponse.json({ batch }, { status: 201 });
    }
    if (body.action === 'approve') {
      const batch = await approveFollowUpBatch(db, String(body.id || ''), isSuperAdmin(auth.admin), actor);
      return NextResponse.json({ batch, sent: false });
    }
    if (body.action === 'send') {
      const decision = await getWhatsAppSendDecision(db);
      const batch = await sendFollowUpBatch(db, String(body.id || ''), decision.blocked, actor);
      return NextResponse.json({ batch, sent: false, queued: true });
    }
    if (body.action === 'delivery') {
      const batch = await recordFollowUpDelivery(db, String(body.id || ''), {
        phone: String(body.phone || ''),
        status: String(body.status || 'sent') as DeliveryStatus,
        detail: String(body.detail || ''),
      });
      if (!batch) return NextResponse.json({ error: 'Follow-up batch not found.' }, { status: 404 });
      return NextResponse.json({ batch });
    }
    return NextResponse.json({ error: 'Unknown follow-up action.' }, { status: 400 });
  } catch (error) {
    const status = error instanceof ChannelSafetyError ? 409 : /super admin|approval|restricted/i.test(error instanceof Error ? error.message : '') ? 403 : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update the follow-up.', sent: false }, { status });
  }
}
