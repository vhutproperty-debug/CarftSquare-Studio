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
  materializeManualRecipientRows,
  getCampaign,
} from '@/lib/ops/campaigns/store';
import {
  materializeProspectAudience,
  previewProspectAudience,
  type ProspectAudienceFilter,
} from '@/lib/ops/campaigns/prospect-audience';
import type { ProspectVariableField } from '@/lib/ops/campaigns/prospect-variables';
import { normalizeOutreachPhone } from '@/lib/ops/outreach-phone';
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
  phones: z.array(z.string().trim().min(8).max(20)).max(500).optional(),
  recipients: z.array(z.object({
    phone: z.string().trim().min(8).max(20),
    name: z.string().trim().max(120).optional(),
    bodyValues: z.array(z.string().max(1000)).max(20).optional(),
  })).max(500).optional(),
  audience: z.object({
    source: z.enum(['manual_phones', 'ops_prospects']).optional(),
    projectName: z.string().trim().max(200).optional(),
    wave: z.number().int().min(1).max(99).optional(),
    batch: z.string().trim().max(80).optional(),
    priority: z.enum(['P1', 'P2', 'P3', 'P4', 'Intl']).optional(),
    campaignTag: z.string().trim().max(120).optional(),
    intent: z.enum(['sell', 'rent', 'interiors', 'not_now']).optional(),
    variableFields: z.array(z.enum(['salutation', 'units'])).min(1).max(2).optional(),
  }).optional(),
  dryRun: z.boolean().optional(),
  scheduledFor: z.string().optional(),
  throttlePerMinute: z.number().int().min(1).max(60).optional(),
}).superRefine((data, ctx) => {
  const source = data.audience?.source
    || (data.phones?.length || data.recipients?.length ? 'manual_phones' : undefined);
  if (source === 'ops_prospects') {
    if (!data.audience?.projectName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'projectName is required when targeting prospects.',
        path: ['audience', 'projectName'],
      });
    }
    return;
  }
  if (!data.phones?.length && !data.recipients?.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide phone numbers, recipients, or a prospect audience.',
      path: ['phones'],
    });
  }
});

function prospectFilterFrom(
  audience: NonNullable<z.infer<typeof createSchema>['audience']>,
): ProspectAudienceFilter {
  return {
    projectName: audience.projectName || '',
    wave: audience.wave,
    batch: audience.batch,
    priority: audience.priority,
    campaignTag: audience.campaignTag,
    intent: audience.intent,
    variableFields: audience.variableFields as ProspectVariableField[] | undefined,
  };
}

function previewManualPhones(
  phones: string[],
  bodyValues: string[],
  named?: Array<{ phone?: string; name?: string; bodyValues?: string[] }>,
) {
  const seen = new Set<string>();
  const rows: Array<{ phone?: string; name?: string; bodyValues?: string[] }> = named?.length
    ? named
    : phones.map((phone) => ({ phone, bodyValues }));
  const recipients = rows.map((row) => {
    const phone = row.phone || '';
    const values = row.bodyValues?.length ? row.bodyValues : bodyValues;
    const outreach = normalizeOutreachPhone(phone);
    if (!outreach) {
      return {
        phone,
        name: row.name,
        status: 'skipped_invalid' as const,
        reason: 'invalid_phone',
        bodyValues: values,
      };
    }
    if (seen.has(outreach.phone)) {
      return {
        phone: outreach.phone,
        name: row.name,
        status: 'skipped_invalid' as const,
        reason: 'duplicate_phone',
        bodyValues: values,
      };
    }
    seen.add(outreach.phone);
    return { phone: outreach.phone, name: row.name, status: 'queued' as const, bodyValues: values };
  });
  return {
    total: recipients.length,
    queued: recipients.filter((row) => row.status === 'queued').length,
    skipped: recipients.filter((row) => row.status !== 'queued').length,
    recipients,
  };
}

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
    const source = parsed.data.audience?.source
      || ((parsed.data.phones?.length || parsed.data.recipients?.length) ? 'manual_phones' : 'manual_phones');
    const variableFields = parsed.data.audience?.variableFields;
    const bodyValues = parsed.data.bodyValues || [];

    if (parsed.data.dryRun) {
      const preview = source === 'ops_prospects'
        ? await previewProspectAudience(db, prospectFilterFrom(parsed.data.audience || {}))
        : previewManualPhones(
          parsed.data.phones || [],
          bodyValues,
          parsed.data.recipients,
        );
      return NextResponse.json({
        dryRun: true,
        preview,
        note: 'Preview only. Nothing was queued or sent.',
      });
    }

    const audience = source === 'ops_prospects'
      ? {
        source: 'ops_prospects' as const,
        projectName: parsed.data.audience?.projectName,
        wave: parsed.data.audience?.wave,
        batch: parsed.data.audience?.batch,
        priority: parsed.data.audience?.priority,
        campaignTag: parsed.data.audience?.campaignTag,
        intent: parsed.data.audience?.intent,
        variableFields,
      }
      : {
        source: 'manual_phones' as const,
        phones: parsed.data.recipients?.length
          ? parsed.data.recipients.map((row) => row.phone)
          : (parsed.data.phones || []),
      };

    const campaign = await createCampaign(db, {
      name: parsed.data.name,
      templateName: parsed.data.templateName,
      languageCode: parsed.data.languageCode,
      bodyValues,
      audience,
      scheduledFor: parsed.data.scheduledFor,
      throttlePerMinute: parsed.data.throttlePerMinute,
      createdBy: auth.admin.id,
    });

    if (source === 'ops_prospects') {
      await materializeProspectAudience(db, campaign, prospectFilterFrom(parsed.data.audience || {}));
    } else if (parsed.data.recipients?.length) {
      await materializeManualRecipientRows(
        db,
        campaign,
        parsed.data.recipients.map((row) => ({
          phone: row.phone,
          name: row.name,
          bodyValues: row.bodyValues,
        })),
      );
    } else {
      await materializeManualRecipients(db, campaign, parsed.data.phones || []);
    }

    const saved = await getCampaign(db, campaign.id);
    await logOpsActivity({
      action: 'create_whatsapp_campaign',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_wa_campaigns',
      resourceId: campaign.id,
      details: {
        recipientCount: saved?.stats.total || 0,
        queued: saved?.stats.queued || 0,
        skipped: saved?.stats.skipped || 0,
        templateName: campaign.templateName,
        audience: audience.source,
      },
      request,
    });

    return NextResponse.json({ campaign: saved }, { status: 201 });
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
      const { reconcileCampaign } = await import('@/lib/whatsapp-cloud/delivery/reconcile');
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
