import type { Db } from 'mongodb';
import { getIntentLabel, getPossessionLabel } from '@/lib/satellite-elegance/constants';
import type { NormalizedOpsLead } from '@/lib/ops/leads/types';
import {
  buildDateRangeQuery,
  campaignIntentCategory,
  matchesLeadSearch,
  pickSafeSummary,
} from '@/lib/ops/leads/normalize';
import { collectionExists } from '@/lib/ops/leads/adapters/shared';
import type { AdapterQueryFilters, LeadSourceAdapter } from '@/lib/ops/leads/adapters/shared';

const COLLECTION = 'satellite_elegance_leads';

type SatelliteLeadDoc = {
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

function normalizeSatelliteLead(doc: SatelliteLeadDoc): NormalizedOpsLead {
  const intentLabel = getIntentLabel(doc.selectedIntent || '');
  return {
    source: 'satellite_elegance',
    sourceId: doc.id,
    sourceCollection: COLLECTION,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt || null,
    name: doc.name || null,
    phone: doc.mobile || null,
    email: null,
    category: campaignIntentCategory(doc.selectedIntent),
    projectName: 'Satellite Elegance',
    intent: intentLabel || doc.selectedIntent || null,
    requirement: getPossessionLabel(doc.possessionTimeline || '') || null,
    budget: null,
    location: 'Satellite Elegance, Mumbai',
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

async function ensureCollection(db: Db): Promise<boolean> {
  return collectionExists(db, COLLECTION);
}

export const satelliteEleganceAdapter: LeadSourceAdapter = {
  source: 'satellite_elegance',
  collection: COLLECTION,
  async fetchLeads(db, filters) {
    if (!(await ensureCollection(db))) return [];
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
      .toArray()) as SatelliteLeadDoc[];

    return docs
      .map(normalizeSatelliteLead)
      .filter((lead) => matchesLeadSearch(lead, filters.search));
  },
  async fetchLeadById(db, id) {
    if (!(await ensureCollection(db))) return null;
    const doc = (await db.collection(COLLECTION).findOne(
      { id },
      { projection: { _id: 0 } },
    )) as SatelliteLeadDoc | null;
    return doc ? normalizeSatelliteLead(doc) : null;
  },
  async countLeads(db, filters) {
    if (!(await ensureCollection(db))) return 0;
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
      .toArray()) as SatelliteLeadDoc[];
    if (!filters.search) return docs.length;
    return docs.map(normalizeSatelliteLead).filter((lead) => matchesLeadSearch(lead, filters.search)).length;
  },
};
