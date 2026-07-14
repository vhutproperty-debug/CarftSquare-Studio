import type { Db } from 'mongodb';
import type { NormalizedOpsLead } from '@/lib/ops/leads/types';
import {
  buildDateRangeQuery,
  matchesLeadSearch,
  pickSafeSummary,
} from '@/lib/ops/leads/normalize';
import type { AdapterQueryFilters, LeadSourceAdapter } from '@/lib/ops/leads/adapters/shared';

const COLLECTION = 'housing_com_leads';

type HousingComLeadDoc = {
  id: string;
  name?: string;
  phone?: string;
  email?: string;
  location?: string;
  requirement?: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt?: string;
};

function normalizeHousingComLead(doc: HousingComLeadDoc): NormalizedOpsLead {
  return {
    source: 'housing_com',
    sourceId: doc.id,
    sourceCollection: COLLECTION,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt || null,
    name: doc.name || null,
    phone: doc.phone || null,
    email: doc.email || null,
    category: 'general',
    requirement: doc.requirement || null,
    location: doc.location || null,
    assignedTo: doc.assignedTo || null,
    rawSummary: pickSafeSummary(doc as Record<string, unknown>, [
      'location',
      'requirement',
    ]),
  };
}

function buildQuery(filters: Omit<AdapterQueryFilters, 'limit'>) {
  return buildDateRangeQuery(filters.dateFrom, filters.dateTo);
}

export const housingComAdapter: LeadSourceAdapter = {
  source: 'housing_com',
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
          phone: 1,
          email: 1,
          location: 1,
          requirement: 1,
          assignedTo: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      })
      .sort({ createdAt: -1 })
      .limit(filters.limit)
      .toArray()) as HousingComLeadDoc[];

    return docs
      .map(normalizeHousingComLead)
      .filter((lead) => matchesLeadSearch(lead, filters.search));
  },
  async fetchLeadById(db, id) {
    const doc = (await db.collection(COLLECTION).findOne(
      { id },
      {
        projection: {
          _id: 0,
          id: 1,
          name: 1,
          phone: 1,
          email: 1,
          location: 1,
          requirement: 1,
          assignedTo: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    )) as HousingComLeadDoc | null;
    return doc ? normalizeHousingComLead(doc) : null;
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
          phone: 1,
          email: 1,
          location: 1,
          requirement: 1,
          createdAt: 1,
        },
      })
      .sort({ createdAt: -1 })
      .limit(2000)
      .toArray()) as HousingComLeadDoc[];
    if (!filters.search) return docs.length;
    return docs.map(normalizeHousingComLead).filter((lead) => matchesLeadSearch(lead, filters.search)).length;
  },
};
