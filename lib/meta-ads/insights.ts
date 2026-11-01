import type { Db } from 'mongodb';
import { isMetaAdsPublishEnabled, getMetaAdsAdAccountId } from '@/lib/meta-ads/config';
import { metaAdsGraph } from '@/lib/meta-ads/client';

export const META_ADS_INSIGHTS_COLLECTION = 'ops_meta_ad_insights';

const FIELDS = 'spend,impressions,clicks,ctr,cpm,actions,cost_per_action_type';

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
