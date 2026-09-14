import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsEditAccess, requireOpsViewAccess } from '@/lib/ops/auth';
import { getCampaign, getCampaignDatabase, updateCampaignStatus } from '@/lib/ops/campaigns/store';
import { OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION } from '@/lib/ops/campaigns/store';
import {
  computeCampaignDeliveryStats,
  reconcileCampaign,
} from '@/lib/interakt/delivery/reconcile';
import { listAttemptsForRecipient } from '@/lib/interakt/delivery/attempts';
import { listTransitionsForRecipient } from '@/lib/interakt/delivery/transitions';
import { scheduleDeliveryRetry, cancelRetryJobsForRecipient } from '@/lib/interakt/delivery/retry-scheduler';
import { transitionRecipientState, getDeliveryRecipient } from '@/lib/interakt/delivery/recipient-state';
import { submitRecipientMessage } from '@/lib/interakt/delivery/submit';

type RouteContext = { params: { id: string } };

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { id } = context.params;
  try {
    const db = await getCampaignDatabase();
    const campaign = await getCampaign(db, id);
    if (!campaign) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });

    const stats = await computeCampaignDeliveryStats(db, id);
    const recipients = await db
      .collection(OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION)
      .find({ campaignId: id }, { projection: { _id: 0 } })
      .sort({ updatedAt: -1 })
      .limit(500)
      .toArray();

    const { searchParams } = new URL(request.url);
    const recipientId = searchParams.get('recipientId');
    let recipientDetail = null;
    if (recipientId) {
      const recipient = await getDeliveryRecipient(db, recipientId);
      const attempts = await listAttemptsForRecipient(db, recipientId);
      const transitions = await listTransitionsForRecipient(db, recipientId);
      recipientDetail = { recipient, attempts, transitions };
    }

    return NextResponse.json({
      campaign: { ...campaign, deliveryStats: stats },
      recipients,
      recipientDetail,
    });
  } catch (error) {
    console.error('[ops-campaigns] detail_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load campaign.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireOpsEditAccess(request);
  if (!auth.ok) return authResultToResponse(auth);

  const { id } = context.params;
  try {
    const body = await request.json();
    const db = await getCampaignDatabase();
    const campaign = await getCampaign(db, id);
    if (!campaign) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });

    if (body.action === 'reconcile') {
      const result = await reconcileCampaign(db, id);
      return NextResponse.json({ ok: true, ...result, campaign: await getCampaign(db, id) });
    }

    if (body.action === 'cancel') {
      await updateCampaignStatus(db, id, 'cancelled', { completedAt: new Date().toISOString() });
      const open = await db
        .collection(OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION)
        .find(
          {
            campaignId: id,
            deliveryState: {
              $nin: ['DELIVERED', 'READ', 'PERMANENT_FAILURE', 'CANCELLED'],
            },
          },
          { projection: { id: 1 } },
        )
        .toArray();
      for (const row of open) {
        await cancelRetryJobsForRecipient(db, String(row.id), 'campaign_cancelled');
        await transitionRecipientState(db, {
          recipientId: String(row.id),
          to: 'CANCELLED',
          eventSource: 'ops_manual',
          reason: 'campaign_cancelled',
          force: true,
        });
      }
      const result = await reconcileCampaign(db, id);
      return NextResponse.json({ ok: true, ...result, campaign: await getCampaign(db, id) });
    }

    if (body.action === 'retry_recipient' && body.recipientId) {
      const recipient = await getDeliveryRecipient(db, String(body.recipientId));
      if (!recipient || recipient.campaignId !== id) {
        return NextResponse.json({ error: 'Recipient not found.' }, { status: 404 });
      }
      if (recipient.doNotContact) {
        return NextResponse.json({ error: 'Recipient opted out.' }, { status: 409 });
      }
      const attemptNumber = recipient.attemptCount || 1;
      await scheduleDeliveryRetry(db, {
        campaignId: id,
        recipientId: recipient.id,
        attemptId: recipient.currentAttemptId || 'manual',
        normalizedPhone: recipient.normalizedPhone,
        attemptNumber,
        scheduledFor: new Date().toISOString(),
      });
      await transitionRecipientState(db, {
        recipientId: recipient.id,
        to: 'RETRY_SCHEDULED',
        eventSource: 'ops_manual',
        reason: 'manual_retry',
        nextRetryAt: new Date().toISOString(),
        force: true,
      });
      // Execute immediately
      const result = await submitRecipientMessage(db, {
        campaign,
        recipientId: recipient.id,
        eventSource: 'ops_manual',
        isRetry: true,
      });
      await reconcileCampaign(db, id);
      return NextResponse.json({ ok: true, result, campaign: await getCampaign(db, id) });
    }

    if (body.action === 'cancel_recipient_retry' && body.recipientId) {
      await cancelRetryJobsForRecipient(db, String(body.recipientId), 'manual_cancel');
      await transitionRecipientState(db, {
        recipientId: String(body.recipientId),
        to: 'CANCELLED',
        eventSource: 'ops_manual',
        reason: 'manual_cancel_retry',
        force: true,
      });
      await reconcileCampaign(db, id);
      return NextResponse.json({ ok: true, campaign: await getCampaign(db, id) });
    }

    if (body.action === 'mark_review' && body.recipientId) {
      await db.collection(OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION).updateOne(
        { id: String(body.recipientId), campaignId: id },
        { $set: { reviewRequired: true, updatedAt: new Date().toISOString() } },
      );
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  } catch (error) {
    console.error('[ops-campaigns] detail_patch_failed', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update campaign.' },
      { status: 500 },
    );
  }
}
