import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import type { OpsWaCampaign, OpsWaCampaignRecipient, WaCampaignStatus } from '@/lib/ops/campaigns/types';
import { isValidIndianMobile, normalizeIndianMobile } from '@/lib/phone/indian-mobile';

export const OPS_WA_CAMPAIGNS_COLLECTION = 'ops_wa_campaigns';
export const OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION = 'ops_wa_campaign_recipients';

let indexesEnsured = false;

export async function ensureCampaignIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  await db.collection(OPS_WA_CAMPAIGNS_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(OPS_WA_CAMPAIGNS_COLLECTION).createIndex({ status: 1, scheduledFor: 1 });
  await db.collection(OPS_WA_CAMPAIGNS_COLLECTION).createIndex({ createdAt: -1 });
  await db.collection(OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION).createIndex({ campaignId: 1, status: 1 });
  await db.collection(OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION).createIndex({ idempotencyKey: 1 }, { unique: true });
  await db.collection(OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION).createIndex({ normalizedPhone: 1 });
  await db.collection(OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION).createIndex({
    deliveryState: 1,
    nextRetryAt: 1,
  });
  await db.collection(OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION).createIndex({ providerMessageId: 1 }, { sparse: true });
  indexesEnsured = true;
}

export async function getCampaignDatabase(): Promise<Db> {
  return getDb() as Promise<Db>;
}

export async function createCampaign(
  db: Db,
  input: {
    name: string;
    templateName: string;
    languageCode?: string;
    bodyValues?: string[];
    audience: OpsWaCampaign['audience'];
    scheduledFor?: string;
    throttlePerMinute?: number;
    createdBy: string;
  },
): Promise<OpsWaCampaign> {
  await ensureCampaignIndexes(db);
  const now = new Date().toISOString();
  const campaign: OpsWaCampaign = {
    id: uuidv4(),
    name: input.name.trim(),
    templateName: input.templateName.trim(),
    languageCode: input.languageCode || 'en',
    bodyValues: input.bodyValues || [],
    audience: input.audience,
    status: input.scheduledFor ? 'scheduled' : 'draft',
    scheduledFor: input.scheduledFor,
    throttlePerMinute: Math.min(Math.max(input.throttlePerMinute || 20, 1), 60),
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
    stats: { total: 0, queued: 0, sent: 0, failed: 0, skipped: 0 },
  };
  await db.collection(OPS_WA_CAMPAIGNS_COLLECTION).insertOne(campaign);
  return campaign;
}

export async function listCampaigns(db: Db, limit = 50): Promise<OpsWaCampaign[]> {
  await ensureCampaignIndexes(db);
  return (await db
    .collection(OPS_WA_CAMPAIGNS_COLLECTION)
    .find({}, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray()) as unknown as OpsWaCampaign[];
}

export async function getCampaign(db: Db, id: string): Promise<OpsWaCampaign | null> {
  await ensureCampaignIndexes(db);
  return (await db.collection(OPS_WA_CAMPAIGNS_COLLECTION).findOne(
    { id },
    { projection: { _id: 0 } },
  )) as unknown as OpsWaCampaign | null;
}

export async function updateCampaignStatus(
  db: Db,
  id: string,
  status: WaCampaignStatus | string,
  patch: Partial<OpsWaCampaign> = {},
): Promise<void> {
  await ensureCampaignIndexes(db);
  await db.collection(OPS_WA_CAMPAIGNS_COLLECTION).updateOne(
    { id },
    { $set: { status, ...patch, updatedAt: new Date().toISOString() } },
  );
}

export async function materializeManualRecipients(
  db: Db,
  campaign: OpsWaCampaign,
  phones: string[],
): Promise<number> {
  await ensureCampaignIndexes(db);
  const now = new Date().toISOString();
  let queued = 0;
  for (const phone of phones) {
    const normalizedPhone = normalizeIndianMobile(phone);
    if (!isValidIndianMobile(normalizedPhone)) {
      const skipped: OpsWaCampaignRecipient = {
        id: uuidv4(),
        campaignId: campaign.id,
        phone,
        normalizedPhone: normalizedPhone || phone,
        status: 'skipped_invalid',
        deliveryState: 'CANCELLED',
        failureClass: 'PERMANENT',
        failureReason: 'invalid_phone',
        idempotencyKey: `${campaign.id}:${normalizedPhone || phone}:invalid`,
        createdAt: now,
        updatedAt: now,
      };
      try {
        await db.collection(OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION).insertOne(skipped);
      } catch {
        /* duplicate skip ok */
      }
      continue;
    }

    const recipient: OpsWaCampaignRecipient = {
      id: uuidv4(),
      campaignId: campaign.id,
      phone,
      normalizedPhone,
      status: 'queued',
      deliveryState: 'QUEUED',
      attemptCount: 0,
      idempotencyKey: `${campaign.id}:${normalizedPhone}`,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await db.collection(OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION).insertOne(recipient);
      queued += 1;
    } catch {
      /* duplicate recipient for campaign */
    }
  }

  const skipped = await db.collection(OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION).countDocuments({
    campaignId: campaign.id,
    status: { $in: ['skipped_invalid', 'skipped_opt_out'] },
  });
  const total = await db.collection(OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION).countDocuments({
    campaignId: campaign.id,
  });

  await db.collection(OPS_WA_CAMPAIGNS_COLLECTION).updateOne(
    { id: campaign.id },
    {
      $set: {
        stats: {
          total,
          queued,
          sent: 0,
          failed: 0,
          skipped,
        },
        updatedAt: now,
      },
    },
  );

  return queued;
}

export async function claimCampaignRecipients(
  db: Db,
  campaignId: string,
  limit: number,
): Promise<OpsWaCampaignRecipient[]> {
  await ensureCampaignIndexes(db);
  const due = (await db
    .collection(OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION)
    .find({ campaignId, status: 'queued' }, { projection: { _id: 0 } })
    .limit(limit)
    .toArray()) as unknown as OpsWaCampaignRecipient[];

  const claimed: OpsWaCampaignRecipient[] = [];
  for (const row of due) {
    const result = await db.collection(OPS_WA_CAMPAIGN_RECIPIENTS_COLLECTION).findOneAndUpdate(
      { id: row.id, status: 'queued' },
      { $set: { status: 'sending', updatedAt: new Date().toISOString() } },
      { returnDocument: 'after', projection: { _id: 0 } },
    );
    if (result) claimed.push(result as unknown as OpsWaCampaignRecipient);
  }
  return claimed;
}
