import type { Db } from 'mongodb';
import { isOptedOut } from '@/lib/whatsapp-cloud/consent';
import { PROSPECTS_COLLECTION } from '@/lib/ops/calls/prospect-store';
import type { OpsProspect, ProspectIntent, ProspectPriority } from '@/lib/ops/calls/types';
import {
  OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION,
  OPS_WA_CAMPAIGNS_COLLECTION,
  ensureCampaignIndexes,
} from '@/lib/ops/campaigns/store';
import type { OpsWaCampaign, OpsWaCampaignRecipient } from '@/lib/ops/campaigns/types';
import {
  renderProspectBodyValues,
  type ProspectVariableField,
} from '@/lib/ops/campaigns/prospect-variables';
import { normalizeOutreachPhone } from '@/lib/ops/outreach-phone';
import { v4 as uuidv4 } from 'uuid';

export type ProspectAudienceFilter = {
  projectName: string;
  wave?: number;
  batch?: string;
  priority?: ProspectPriority;
  campaignTag?: string;
  intent?: ProspectIntent;
  variableFields?: ProspectVariableField[];
};

export type AudiencePreviewRecipient = {
  prospectId?: string;
  name?: string;
  phone: string;
  status: 'queued' | 'skipped_opt_out' | 'skipped_invalid';
  reason?: string;
  bodyValues: string[];
};

export type AudiencePreview = {
  total: number;
  queued: number;
  skipped: number;
  recipients: AudiencePreviewRecipient[];
};

const AUDIENCE_LIMIT = 500;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildProspectAudienceQuery(filter: ProspectAudienceFilter): Record<string, unknown> {
  const query: Record<string, unknown> = {
    projectName: { $regex: `^${escapeRegex(filter.projectName.trim())}$`, $options: 'i' },
  };
  if (filter.wave != null) query.wave = filter.wave;
  if (filter.priority) query.priority = filter.priority;
  if (filter.batch?.trim()) query.batch = filter.batch.trim();
  if (filter.campaignTag?.trim()) query.campaignTag = filter.campaignTag.trim();
  if (filter.intent) query.intent = filter.intent;
  return query;
}

function contactBlocked(prospect: OpsProspect): boolean {
  return Boolean(
    prospect.optOut
    || prospect.doNotContact
    || prospect.callStatus === 'DO_NOT_CALL',
  );
}

export async function previewProspectAudience(
  db: Db,
  filter: ProspectAudienceFilter,
): Promise<AudiencePreview> {
  const projectName = filter.projectName?.trim();
  if (!projectName) {
    throw Object.assign(new Error('projectName is required to target prospects.'), { status: 400 });
  }
  const fields = filter.variableFields?.length ? filter.variableFields : ['salutation', 'units'] as ProspectVariableField[];
  const prospects = (await db
    .collection(PROSPECTS_COLLECTION)
    .find(buildProspectAudienceQuery({ ...filter, projectName }), { projection: { _id: 0 } })
    .limit(AUDIENCE_LIMIT + 1)
    .toArray()) as unknown as OpsProspect[];

  if (prospects.length > AUDIENCE_LIMIT) {
    throw Object.assign(
      new Error(`Audience exceeds ${AUDIENCE_LIMIT} prospects. Narrow wave, batch, or priority.`),
      { status: 400 },
    );
  }

  const seen = new Set<string>();
  const recipients: AudiencePreviewRecipient[] = [];
  for (const prospect of prospects) {
    const phone = normalizeOutreachPhone(prospect.phone);
    const bodyValues = renderProspectBodyValues(prospect, fields);
    if (!phone) {
      recipients.push({
        prospectId: prospect.id,
        name: prospect.name,
        phone: prospect.phone,
        status: 'skipped_invalid',
        reason: 'invalid_phone',
        bodyValues,
      });
      continue;
    }
    if (seen.has(phone.phone)) {
      recipients.push({
        prospectId: prospect.id,
        name: prospect.name,
        phone: phone.phone,
        status: 'skipped_invalid',
        reason: 'duplicate_phone',
        bodyValues,
      });
      continue;
    }
    seen.add(phone.phone);
    if (contactBlocked(prospect) || await isOptedOut(db, phone.phone)) {
      recipients.push({
        prospectId: prospect.id,
        name: prospect.name,
        phone: phone.phone,
        status: 'skipped_opt_out',
        reason: 'opt_out',
        bodyValues,
      });
      continue;
    }
    if (prospect.phoneInvalid || prospect.callStatus === 'WRONG_NUMBER') {
      recipients.push({
        prospectId: prospect.id,
        name: prospect.name,
        phone: phone.phone,
        status: 'skipped_invalid',
        reason: 'invalid_phone',
        bodyValues,
      });
      continue;
    }
    recipients.push({
      prospectId: prospect.id,
      name: prospect.name,
      phone: phone.phone,
      status: 'queued',
      bodyValues,
    });
  }

  return {
    total: recipients.length,
    queued: recipients.filter((row) => row.status === 'queued').length,
    skipped: recipients.filter((row) => row.status !== 'queued').length,
    recipients,
  };
}

export async function materializeProspectAudience(
  db: Db,
  campaign: OpsWaCampaign,
  filter: ProspectAudienceFilter,
): Promise<AudiencePreview> {
  await ensureCampaignIndexes(db);
  const preview = await previewProspectAudience(db, filter);
  const now = new Date().toISOString();

  for (const row of preview.recipients) {
    const skipped = row.status !== 'queued';
    const recipient: OpsWaCampaignRecipient = {
      id: uuidv4(),
      campaignId: campaign.id,
      prospectId: row.prospectId,
      name: row.name,
      phone: row.phone,
      normalizedPhone: row.phone,
      status: row.status,
      deliveryState: skipped ? 'CANCELLED' : 'QUEUED',
      attemptCount: 0,
      doNotContact: row.status === 'skipped_opt_out',
      failureClass: skipped ? 'PERMANENT' : undefined,
      failureReason: row.reason || null,
      bodyValues: row.bodyValues,
      idempotencyKey: `${campaign.id}:${row.phone}`,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await db.collection(OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION).insertOne(recipient);
    } catch {
      /* duplicate recipient for this campaign */
    }
  }

  await db.collection(OPS_WA_CAMPAIGNS_COLLECTION).updateOne(
    { id: campaign.id },
    {
      $set: {
        stats: {
          total: preview.total,
          queued: preview.queued,
          sent: 0,
          failed: 0,
          skipped: preview.skipped,
        },
        updatedAt: now,
      },
    },
  );

  return preview;
}
