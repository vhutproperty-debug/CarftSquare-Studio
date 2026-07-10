import type { Db } from 'mongodb';
import type { NormalizedOpsLead } from '@/lib/ops/leads/types';
import {
  buildDateRangeQuery,
  matchesLeadSearch,
  pickSafeSummary,
} from '@/lib/ops/leads/normalize';
import type { AdapterQueryFilters, LeadSourceAdapter } from '@/lib/ops/leads/adapters/shared';

const COLLECTION = 'designer_callback_leads';

type DesignerLeadDoc = {
  id: string;
  name?: string;
  phone?: string;
  city?: string;
  projectType?: string;
  message?: string;
  preferredCallTime?: string;
  source?: string;
  landingPage?: string;
  status?: string;
  createdAt: string;
  updatedAt?: string;
};

function normalizeDesignerLead(doc: DesignerLeadDoc): NormalizedOpsLead {
  const category = doc.projectType?.toLowerCase().includes('rental') ? 'rental' : 'callback';
  return {
    source: 'designer_callback',
    sourceId: doc.id,
    sourceCollection: COLLECTION,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt || null,
    name: doc.name || null,
    phone: doc.phone || null,
    email: null,
    category,
    projectName: doc.projectType || null,
    intent: doc.source || null,
    requirement: doc.message || null,
    budget: null,
    location: doc.city || null,
    sourceStatus: doc.status || null,
    rawSummary: pickSafeSummary(doc as Record<string, unknown>, [
      'projectType',
      'message',
      'preferredCallTime',
      'source',
      'landingPage',
    ]),
  };
}

function buildQuery(filters: Omit<AdapterQueryFilters, 'limit'>) {
  return buildDateRangeQuery(filters.dateFrom, filters.dateTo);
}

export const designerCallbackAdapter: LeadSourceAdapter = {
  source: 'designer_callback',
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
          city: 1,
          projectType: 1,
          message: 1,
          preferredCallTime: 1,
          source: 1,
          landingPage: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      })
      .sort({ createdAt: -1 })
      .limit(filters.limit)
      .toArray()) as DesignerLeadDoc[];

    return docs
      .map(normalizeDesignerLead)
      .filter((lead) => matchesLeadSearch(lead, filters.search));
  },
  async fetchLeadById(db, id) {
    const doc = (await db.collection(COLLECTION).findOne(
      { id },
      { projection: { _id: 0 } },
    )) as DesignerLeadDoc | null;
    return doc ? normalizeDesignerLead(doc) : null;
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
          city: 1,
          projectType: 1,
          message: 1,
          createdAt: 1,
        },
      })
      .sort({ createdAt: -1 })
      .limit(2000)
      .toArray()) as DesignerLeadDoc[];
    if (!filters.search) return docs.length;
    return docs.map(normalizeDesignerLead).filter((lead) => matchesLeadSearch(lead, filters.search)).length;
  },
};
