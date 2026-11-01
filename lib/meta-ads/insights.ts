import type { Db } from 'mongodb';
import { isMetaAdsPublishEnabled, getMetaAdsAdAccountId } from '@/lib/meta-ads/config';
import { metaAdsGraph } from '@/lib/meta-ads/client';

export const META_ADS_INSIGHTS_COLLECTION = 'ops_meta_ad_insights';

const FIELDS = 'spend,impressions,clicks,ctr,cpm,actions,cost_per_action_type';

export const CAMPAIGN_INSIGHT_PRESETS = [
  'today',
  'yesterday',
  'last_7d',
  'last_14d',
  'last_30d',
  'this_month',
  'last_month',
] as const;

export type CampaignInsightPreset = (typeof CAMPAIGN_INSIGHT_PRESETS)[number];

const INSIGHT_DATE = /^\d{4}-\d{2}-\d{2}$/;

const LEAD_ACTION_PRIORITY = [
  'onsite_conversion.lead_grouped',
  'lead',
  'leadgen.other',
  'offsite_conversion.fb_pixel_lead',
  'leadgen_grouped',
] as const;

export type CampaignInsightRow = {
  campaignId: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  cpl: number | null;
};

type ActionMetric = { action_type?: string; value?: string };

type InsightNode = {
  campaign_id?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: ActionMetric[];
  cost_per_action_type?: ActionMetric[];
};

function inputError(message: string) {
  return Object.assign(new Error(message), { status: 400 });
}

function metricForAction(rows: ActionMetric[] | undefined) {
  const list = rows || [];
  for (const actionType of LEAD_ACTION_PRIORITY) {
    const match = list.find((row) => row.action_type === actionType);
    if (!match) continue;
    const value = Number(match.value);
    if (Number.isFinite(value)) return { actionType, value };
  }
  return null;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function normalizeCampaignInsight(row: InsightNode): CampaignInsightRow | null {
  if (!row.campaign_id) return null;
  const spend = Number(row.spend || 0);
  const impressions = Number(row.impressions || 0);
  const clicks = Number(row.clicks || 0);
  const leadsMetric = metricForAction(row.actions);
  const leads = leadsMetric?.value ?? 0;
  const costMetric = leadsMetric
    ? (row.cost_per_action_type || []).find((item) => item.action_type === leadsMetric.actionType)
    : undefined;
  const costValue = costMetric ? Number(costMetric.value) : NaN;
  let cpl: number | null = null;
  if (Number.isFinite(costValue)) cpl = roundMoney(costValue);
  else if (leads > 0 && Number.isFinite(spend)) cpl = roundMoney(spend / leads);
  return {
    campaignId: String(row.campaign_id),
    campaignName: row.campaign_name || String(row.campaign_id),
    spend: Number.isFinite(spend) ? roundMoney(spend) : 0,
    impressions: Number.isFinite(impressions) ? impressions : 0,
    clicks: Number.isFinite(clicks) ? clicks : 0,
    leads,
    cpl,
  };
}

/** Live ads_read. Not gated by META_ADS_ENABLED — publishing flags do not block reporting. */
export async function readCampaignInsights(range: {
  preset?: string;
  since?: string;
  until?: string;
}): Promise<CampaignInsightRow[]> {
  const act = getMetaAdsAdAccountId();
  if (!/^act_\d+$/.test(act)) {
    throw inputError('META_AD_ACCOUNT_ID is not a valid ad account id.');
  }
  const params = new URLSearchParams({
    level: 'campaign',
    fields: 'campaign_id,campaign_name,spend,impressions,clicks,actions,cost_per_action_type',
    limit: '100',
  });
  if (range.since || range.until) {
    if (!range.since || !range.until || !INSIGHT_DATE.test(range.since) || !INSIGHT_DATE.test(range.until)) {
      throw inputError('Use a start and end date in YYYY-MM-DD format.');
    }
    if (range.since > range.until) {
      throw inputError('The start date must be on or before the end date.');
    }
    params.set('time_range', JSON.stringify({ since: range.since, until: range.until }));
  } else {
    const preset = range.preset || 'last_7d';
    if (!CAMPAIGN_INSIGHT_PRESETS.includes(preset as CampaignInsightPreset)) {
      throw inputError('Unknown date range.');
    }
    params.set('date_preset', preset);
  }
  const data = await metaAdsGraph<{ data?: InsightNode[] }>(`/${act}/insights?${params.toString()}`);
  return (data.data || []).flatMap((row) => {
    const normalized = normalizeCampaignInsight(row);
    return normalized ? [normalized] : [];
  });
}

export async function syncMetaAdsInsights(db: Db, level: 'campaign' | 'adset' | 'ad' = 'campaign') {
  if (!isMetaAdsPublishEnabled()) {
    return { ok: true, skipped: true, reason: 'META_ADS_ENABLED is false', synced: 0 };
  }
  const act = getMetaAdsAdAccountId();
  const data = await metaAdsGraph<{ data?: Array<Record<string, unknown>> }>(
    `/${act}/insights?level=${level}&fields=${FIELDS}&date_preset=last_7d&limit=100`,
  );
  const now = new Date().toISOString();
  const rows = data.data || [];
  for (const row of rows) {
    const id = String(row.campaign_id || row.adset_id || row.ad_id || row.account_id || '');
    if (!id) continue;
    await db.collection(META_ADS_INSIGHTS_COLLECTION).updateOne(
      { level, objectId: id, datePreset: 'last_7d' },
      { $set: { level, objectId: id, datePreset: 'last_7d', metrics: row, updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true },
    );
  }
  return { ok: true, skipped: false, synced: rows.length };
}
