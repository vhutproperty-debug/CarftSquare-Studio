import type { Db } from 'mongodb';
import type { NormalizedOpsLead } from '@/lib/ops/leads/types';
import {
  buildDateRangeQuery,
  inferCategoryFromService,
  matchesLeadSearch,
  pickSafeSummary,
} from '@/lib/ops/leads/normalize';
import type { AdapterQueryFilters, LeadSourceAdapter } from '@/lib/ops/leads/adapters/shared';

const COLLECTION = 'leads';

type HomepageLeadDoc = {
  id: string;
  name?: string;
  phone?: string;
  email?: string;
  location?: string;
  city?: string;
  service?: string;
  bhk?: string;
  area?: number;
  notes?: string;
  source?: string;
  status?: string;
  projectType?: string;
  preferredSlot?: string;
  createdAt: string;
  updatedAt?: string;
};

function normalizeHomepageLead(doc: HomepageLeadDoc): NormalizedOpsLead {
  const requirement = [doc.bhk, doc.area ? `${doc.area} sq.ft` : '', doc.notes].filter(Boolean).join(' · ');
  return {
    source: 'homepage',
    sourceId: doc.id,
    sourceCollection: COLLECTION,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt || null,
    name: doc.name || null,
    phone: doc.phone || null,
    email: doc.email || null,
    category: inferCategoryFromService(doc.service),
    projectName: doc.service || null,
    intent: doc.projectType || null,
    requirement: requirement || null,
    budget: null,
    location: doc.location || doc.city || null,
    sourceStatus: doc.status || null,
    rawSummary: pickSafeSummary(doc as Record<string, unknown>, [
      'service',
      'bhk',
      'area',
      'propertyType',
      'paintQuality',
      'preferredSlot',
      'source',
      'notes',
    ]),
  };
}

function buildQuery(filters: Omit<AdapterQueryFilters, 'limit'>) {
  return buildDateRangeQuery(filters.dateFrom, filters.dateTo);
}

export const homepageAdapter: LeadSourceAdapter = {
  source: 'homepage',
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
          city: 1,
          service: 1,
          bhk: 1,
          area: 1,
          notes: 1,
          source: 1,
          status: 1,
          projectType: 1,
          preferredSlot: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      })
      .sort({ createdAt: -1 })
      .limit(filters.limit)
      .toArray()) as HomepageLeadDoc[];

    return docs
      .map(normalizeHomepageLead)
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
          city: 1,
          service: 1,
          bhk: 1,
          area: 1,
          notes: 1,
          source: 1,
          status: 1,
          projectType: 1,
          preferredSlot: 1,
          propertyType: 1,
          paintQuality: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    )) as HomepageLeadDoc | null;
    return doc ? normalizeHomepageLead(doc) : null;
  },
  async countLeads(db, filters) {
    const query = buildQuery(filters);
    const docs = (await db
      .collection(COLLECTION)
      .find(query, { projection: { _id: 0, id: 1, name: 1, phone: 1, email: 1, service: 1, bhk: 1, notes: 1, location: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .limit(2000)
      .toArray()) as HomepageLeadDoc[];
    if (!filters.search) return docs.length;
    return docs.map(normalizeHomepageLead).filter((lead) => matchesLeadSearch(lead, filters.search)).length;
  },
};
