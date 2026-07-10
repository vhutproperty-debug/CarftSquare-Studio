import type { Db } from 'mongodb';
import { getIntentLabel, getPossessionLabel } from '@/lib/auris-serenity/constants';
import type { NormalizedOpsLead } from '@/lib/ops/leads/types';
import {
  buildDateRangeQuery,
  campaignIntentCategory,
  matchesLeadSearch,
  pickSafeSummary,
} from '@/lib/ops/leads/normalize';
import type { AdapterQueryFilters, LeadSourceAdapter } from '@/lib/ops/leads/adapters/shared';

const COLLECTION = 'auris_serenity_leads';

type AurisLeadDoc = {
  id: string;
  name?: string;
  mobile?: string;
  selectedIntent?: string;
  possessionTimeline?: string;
  source?: string;
  pagePath?: string;
  status?: string;
  createdAt: string;
  updatedAt?: string;
};

function normalizeAurisLead(doc: AurisLeadDoc): NormalizedOpsLead {
  const intentLabel = getIntentLabel(doc.selectedIntent || '');
  return {
    source: 'auris_serenity',
    sourceId: doc.id,
    sourceCollection: COLLECTION,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt || null,
    name: doc.name || null,
    phone: doc.mobile || null,
    email: null,
    category: campaignIntentCategory(doc.selectedIntent),
    projectName: 'Auris Serenity',
    intent: intentLabel || doc.selectedIntent || null,
    requirement: getPossessionLabel(doc.possessionTimeline || '') || null,
    budget: null,
    location: 'Auris Serenity, Mumbai',
    sourceStatus: doc.status || null,
    rawSummary: pickSafeSummary(doc as Record<string, unknown>, [
      'selectedIntent',
      'possessionTimeline',
      'source',
      'pagePath',
    ]),
  };
}

function buildQuery(filters: Omit<AdapterQueryFilters, 'limit'>) {
  return buildDateRangeQuery(filters.dateFrom, filters.dateTo);
}

export const aurisSerenityAdapter: LeadSourceAdapter = {
  source: 'auris_serenity',
  collection: COLLECTION,
  async fetchLeads(db, filters) {
    const query = buildQuery(filters);
    const docs = (await db
      .collection(COLLECTION)
      .find(query, {
        projection: {
          _id: 0,
          id: 1,
          name: 1,
          mobile: 1,
          selectedIntent: 1,
          possessionTimeline: 1,
          source: 1,
          pagePath: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      })
      .sort({ createdAt: -1 })
      .limit(filters.limit)
      .toArray()) as AurisLeadDoc[];

    return docs
      .map(normalizeAurisLead)
      .filter((lead) => matchesLeadSearch(lead, filters.search));
  },
  async fetchLeadById(db, id) {
    const doc = (await db.collection(COLLECTION).findOne(
      { id },
      { projection: { _id: 0 } },
    )) as AurisLeadDoc | null;
    return doc ? normalizeAurisLead(doc) : null;
  },
  async countLeads(db, filters) {
    const query = buildQuery(filters);
    const docs = (await db
      .collection(COLLECTION)
      .find(query, {
        projection: {
          _id: 0,
          id: 1,
          name: 1,
          mobile: 1,
          selectedIntent: 1,
          possessionTimeline: 1,
          createdAt: 1,
        },
      })
      .sort({ createdAt: -1 })
      .limit(2000)
      .toArray()) as AurisLeadDoc[];
    if (!filters.search) return docs.length;
    return docs.map(normalizeAurisLead).filter((lead) => matchesLeadSearch(lead, filters.search)).length;
  },
};
