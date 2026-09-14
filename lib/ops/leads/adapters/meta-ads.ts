import type { Db } from 'mongodb';
import type { NormalizedOpsLead } from '@/lib/ops/leads/types';
import {
  buildDateRangeQuery,
  matchesLeadSearch,
  pickSafeSummary,
} from '@/lib/ops/leads/normalize';
import type { AdapterQueryFilters, LeadSourceAdapter } from '@/lib/ops/leads/adapters/shared';

export const META_ADS_LEADS_COLLECTION = 'meta_ads_leads';

type MetaAdsLeadDoc = {
  id: string;
  name?: string;
  phone?: string;
  email?: string;
  formId?: string;
  formName?: string;
  campaignId?: string;
  campaignName?: string;
  adId?: string;
  adName?: string;
  platform?: string;
  fieldData?: Record<string, string>;
  status?: string;
  createdAt: string;
  updatedAt?: string;
};

function normalizeMetaAdsLead(doc: MetaAdsLeadDoc): NormalizedOpsLead {
  const requirement = [
    doc.formName,
    doc.campaignName,
    doc.adName,
    doc.fieldData?.project || doc.fieldData?.requirement,
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    source: 'meta_ads',
    sourceId: doc.id,
    sourceCollection: META_ADS_LEADS_COLLECTION,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt || null,
    name: doc.name || null,
    phone: doc.phone || null,
    email: doc.email || null,
    category: 'general',
    projectName: doc.campaignName || doc.formName || null,
    intent: doc.platform || 'meta_lead_ads',
    requirement: requirement || null,
    budget: doc.fieldData?.budget || null,
    location: doc.fieldData?.city || doc.fieldData?.location || null,
    sourceStatus: doc.status || null,
    rawSummary: pickSafeSummary(doc as Record<string, unknown>, [
      'formId',
      'formName',
      'campaignId',
      'campaignName',
      'adId',
      'adName',
      'platform',
      'status',
    ]),
  };
}

export const metaAdsAdapter: LeadSourceAdapter = {
  source: 'meta_ads',
  collection: META_ADS_LEADS_COLLECTION,
  async fetchLeads(db, filters) {
    const query = buildDateRangeQuery(filters.dateFrom, filters.dateTo);
    const docs = (await db
      .collection(META_ADS_LEADS_COLLECTION)
      .find(query, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .limit(filters.limit)
      .toArray()) as MetaAdsLeadDoc[];
    return docs.map(normalizeMetaAdsLead).filter((lead) => matchesLeadSearch(lead, filters.search));
  },
  async fetchLeadById(db, id) {
    const doc = (await db.collection(META_ADS_LEADS_COLLECTION).findOne(
      { id },
      { projection: { _id: 0 } },
    )) as MetaAdsLeadDoc | null;
    return doc ? normalizeMetaAdsLead(doc) : null;
  },
  async countLeads(db, filters) {
    const query = buildDateRangeQuery(filters.dateFrom, filters.dateTo);
    if (!filters.search) {
      return db.collection(META_ADS_LEADS_COLLECTION).countDocuments(query);
    }
    const docs = (await db
      .collection(META_ADS_LEADS_COLLECTION)
      .find(query, { projection: { _id: 0 } })
      .limit(2000)
      .toArray()) as MetaAdsLeadDoc[];
    return docs.map(normalizeMetaAdsLead).filter((lead) => matchesLeadSearch(lead, filters.search)).length;
  },
};

export async function ensureMetaAdsLeadIndexes(db: Db): Promise<void> {
  await db.collection(META_ADS_LEADS_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(META_ADS_LEADS_COLLECTION).createIndex({ createdAt: -1 });
  await db.collection(META_ADS_LEADS_COLLECTION).createIndex({ phone: 1 });
  await db.collection(META_ADS_LEADS_COLLECTION).createIndex({ campaignId: 1 });
  await db.collection(META_ADS_LEADS_COLLECTION).createIndex({ formId: 1 });
}
