import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsEditAccess, requireOpsViewAccess } from '@/lib/ops/auth';
import { logOpsActivity } from '@/lib/ops/activity/store';
import {
  createCampaign,
  getCampaignDatabase,
  listCampaigns,
  materializeManualRecipients,
  getCampaign,
} from '@/lib/ops/campaigns/store';
import { startCampaign, processCampaignBatch } from '@/lib/ops/campaigns/worker';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const db = await getCampaignDatabase();
    const campaigns = await listCampaigns(db);
    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error('[ops-campaigns] list_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to list campaigns.' }, { status: 500 });
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  templateName: z.string().trim().min(1).max(120),
  languageCode: z.string().trim().min(2).max(10).optional(),
  bodyValues: z.array(z.string().max(1000)).max(20).optional(),
  phones: z.array(z.string().trim().min(8).max(20)).min(1).max(500),
  scheduledFor: z.string().optional(),
  throttlePerMinute: z.number().int().min(1).max(60).optional(),
});

export async function POST(request: Request) {
  const auth = await requireOpsEditAccess(request);
  if (!auth.ok) return authResultToResponse(auth);

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const db = await getCampaignDatabase();
    const campaign = await createCampaign(db, {
      name: parsed.data.name,
      templateName: parsed.data.templateName,
      languageCode: parsed.data.languageCode,
      bodyValues: parsed.data.bodyValues,
      audience: { source: 'manual_phones', phones: parsed.data.phones },
      scheduledFor: parsed.data.scheduledFor,
      throttlePerMinute: parsed.data.throttlePerMinute,
      createdBy: auth.admin.id,
    });

    await materializeManualRecipients(db, campaign, parsed.data.phones);

    await logOpsActivity({
      action: 'create_whatsapp_campaign',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_wa_campaigns',
      resourceId: campaign.id,
      details: { recipientCount: parsed.data.phones.length, templateName: campaign.templateName },
      request,
    });

    return NextResponse.json({ campaign: await getCampaign(db, campaign.id) }, { status: 201 });
  } catch (error) {
    console.error('[ops-campaigns] create_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to create campaign.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireOpsEditAccess(request);
  if (!auth.ok) return authResultToResponse(auth);

  try {
    const body = await request.json();
    const id = String(body.id || '');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const db = await getCampaignDatabase();

    if (body.action === 'start') {
      const result = await startCampaign(db, id);
      return NextResponse.json({ ok: true, ...result, campaign: await getCampaign(db, id) });
    }
    if (body.action === 'tick') {
      const result = await processCampaignBatch(db, id);
      return NextResponse.json({ ok: true, ...result, campaign: await getCampaign(db, id) });
    }
    if (body.action === 'reconcile') {
      const { reconcileCampaign } = await import('@/lib/interakt/delivery/reconcile');
      const result = await reconcileCampaign(db, id);
      return NextResponse.json({ ok: true, ...result, campaign: await getCampaign(db, id) });
    }
    if (body.action === 'cancel') {
      const { updateCampaignStatus } = await import('@/lib/ops/campaigns/store');
      await updateCampaignStatus(db, id, 'cancelled', { completedAt: new Date().toISOString() });
      return NextResponse.json({ ok: true, campaign: await getCampaign(db, id) });
    }
    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  } catch (error) {
    const status = (error as { status?: number }).status || 500;
    console.error('[ops-campaigns] patch_failed', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update campaign.' },
      { status },
    );
  }
}
