import type { Db } from 'mongodb';
import { PROPERTIES_LEADS_COLLECTION, getPropertiesIntentLabel } from '@/lib/properties/constants';
import type { NormalizedOpsLead, OpsLeadCategory } from '@/lib/ops/leads/types';
import { buildDateRangeQuery, matchesLeadSearch, pickSafeSummary } from '@/lib/ops/leads/normalize';
import { collectionExists } from '@/lib/ops/leads/adapters/shared';
import type { AdapterQueryFilters, LeadSourceAdapter } from '@/lib/ops/leads/adapters/shared';

const COLLECTION = PROPERTIES_LEADS_COLLECTION;

type PropertiesLeadDoc = {
  id: string;
  name?: string;
  mobile?: string;
  email?: string;
  intent?: string;
  area?: string;
  budget?: string;
  message?: string;
  source?: string;
  pagePath?: string;
  status?: string;
  assignedTo?: string;
  utm?: Record<string, string>;
  consent?: { version?: string; timestamp?: string };
  createdAt: string;
  updatedAt?: string;
};

function intentCategory(intent?: string): OpsLeadCategory {
  if (intent === 'rent' || intent === 'rent_out') return 'rental';
  if (intent === 'interiors') return 'interior';
  return 'general';
}

function normalizePropertiesLead(doc: PropertiesLeadDoc): NormalizedOpsLead {
  return {
    source: 'properties',
    sourceId: doc.id,
    sourceCollection: COLLECTION,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt || null,
    name: doc.name || null,
    phone: doc.mobile || null,
    email: doc.email || null,
    category: intentCategory(doc.intent),
    projectName: doc.area || 'CraftSquare Properties',
    intent: getPropertiesIntentLabel(doc.intent || '') || doc.intent || null,
    requirement: doc.message || null,
    budget: doc.budget || null,
    location: doc.area || 'Mumbai',
    sourceStatus: doc.status || null,
    assignedTo: doc.assignedTo || null,
    rawSummary: pickSafeSummary(
      {
        ...(doc as Record<string, unknown>),
        consentVersion: doc.consent?.version,
        consentAt: doc.consent?.timestamp,
        utmSource: doc.utm?.utmSource,
        utmCampaign: doc.utm?.utmCampaign,
      },
      ['intent', 'area', 'budget', 'source', 'pagePath', 'consentVersion', 'consentAt', 'utmSource', 'utmCampaign'],
    ),
  };
}

const LIST_PROJECTION = {
  _id: 0,
  id: 1,
  name: 1,
  mobile: 1,
  email: 1,
  intent: 1,
  area: 1,
  budget: 1,
  message: 1,
  source: 1,
  pagePath: 1,
  status: 1,
  assignedTo: 1,
  utm: 1,
  consent: 1,
  createdAt: 1,
  updatedAt: 1,
};

function buildQuery(filters: Omit<AdapterQueryFilters, 'limit'>) {
  return buildDateRangeQuery(filters.dateFrom, filters.dateTo);
}

export const propertiesAdapter: LeadSourceAdapter = {
  source: 'properties',
  collection: COLLECTION,
  async fetchLeads(db: Db, filters) {
    if (!(await collectionExists(db, COLLECTION))) return [];
    const docs = (await db
      .collection(COLLECTION)
      .find(buildQuery(filters), { projection: LIST_PROJECTION })
      .sort({ createdAt: -1 })
      .limit(filters.limit)
      .toArray()) as unknown as PropertiesLeadDoc[];
    return docs.map(normalizePropertiesLead).filter((lead) => matchesLeadSearch(lead, filters.search));
  },
  async fetchLeadById(db: Db, id) {
    if (!(await collectionExists(db, COLLECTION))) return null;
    const doc = (await db.collection(COLLECTION).findOne({ id }, { projection: { _id: 0 } })) as unknown as PropertiesLeadDoc | null;
    return doc ? normalizePropertiesLead(doc) : null;
  },
  async countLeads(db: Db, filters) {
    if (!(await collectionExists(db, COLLECTION))) return 0;
    const query = buildQuery(filters);
    if (!filters.search) return db.collection(COLLECTION).countDocuments(query);
    const docs = (await db
      .collection(COLLECTION)
      .find(query, { projection: LIST_PROJECTION })
      .sort({ createdAt: -1 })
      .limit(2000)
      .toArray()) as unknown as PropertiesLeadDoc[];
    return docs.map(normalizePropertiesLead).filter((lead) => matchesLeadSearch(lead, filters.search)).length;
  },
};
