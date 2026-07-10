import type { Db } from 'mongodb';
import type { NormalizedOpsLead } from '@/lib/ops/leads/types';
import {
  buildDateRangeQuery,
  matchesLeadSearch,
  pickSafeSummary,
} from '@/lib/ops/leads/normalize';
import type { AdapterQueryFilters, LeadSourceAdapter } from '@/lib/ops/leads/adapters/shared';

const COLLECTION = 'painting_leads';

type PaintingLeadDoc = {
  id: string;
  name?: string;
  mobile?: string;
  email?: string;
  location?: string;
  propertyType?: string;
  apartmentSize?: string;
  requirement?: string;
  visitDate?: string;
  budget?: string;
  message?: string;
  leadSource?: string;
  status?: string;
  createdAt: string;
  updatedAt?: string;
};

function normalizePaintingLead(doc: PaintingLeadDoc): NormalizedOpsLead {
  return {
    source: 'painting',
    sourceId: doc.id,
    sourceCollection: COLLECTION,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt || null,
    name: doc.name || null,
    phone: doc.mobile || null,
    email: doc.email || null,
    category: 'painting',
    projectName: doc.propertyType || null,
    intent: doc.apartmentSize || null,
    requirement: doc.requirement || doc.message || null,
    budget: doc.budget || null,
    location: doc.location || null,
    sourceStatus: doc.status || null,
    rawSummary: pickSafeSummary(doc as Record<string, unknown>, [
      'propertyType',
      'apartmentSize',
      'requirement',
      'visitDate',
      'budget',
      'message',
      'leadSource',
    ]),
  };
}

function buildQuery(filters: Omit<AdapterQueryFilters, 'limit'>) {
  return buildDateRangeQuery(filters.dateFrom, filters.dateTo);
}

export const paintingAdapter: LeadSourceAdapter = {
  source: 'painting',
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
          email: 1,
          location: 1,
          propertyType: 1,
          apartmentSize: 1,
          requirement: 1,
          visitDate: 1,
          budget: 1,
          message: 1,
          leadSource: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      })
      .sort({ createdAt: -1 })
      .limit(filters.limit)
      .toArray()) as PaintingLeadDoc[];

    return docs
      .map(normalizePaintingLead)
      .filter((lead) => matchesLeadSearch(lead, filters.search));
  },
  async fetchLeadById(db, id) {
    const doc = (await db.collection(COLLECTION).findOne(
      { id },
      { projection: { _id: 0 } },
    )) as PaintingLeadDoc | null;
    return doc ? normalizePaintingLead(doc) : null;
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
          email: 1,
          location: 1,
          requirement: 1,
          message: 1,
          budget: 1,
          createdAt: 1,
        },
      })
      .sort({ createdAt: -1 })
      .limit(2000)
      .toArray()) as PaintingLeadDoc[];
    if (!filters.search) return docs.length;
    return docs.map(normalizePaintingLead).filter((lead) => matchesLeadSearch(lead, filters.search)).length;
  },
};
