import type { Db } from 'mongodb';
import type { NormalizedOpsLead } from '@/lib/ops/leads/types';
import {
  buildDateRangeQuery,
  matchesLeadSearch,
  pickSafeSummary,
  quotationCategory,
} from '@/lib/ops/leads/normalize';
import type { AdapterQueryFilters, LeadSourceAdapter } from '@/lib/ops/leads/adapters/shared';

const COLLECTION = 'quotation_quotes';

type QuotationLeadDoc = {
  id: string;
  quoteNumber?: string;
  moduleId?: string;
  projectCategory?: string;
  leadSource?: string;
  campaignName?: string;
  landingPage?: string;
  status?: string;
  leadScore?: number;
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
    whatsapp?: string;
  };
  answers?: Record<string, unknown>;
  aiSummary?: {
    budget?: string;
    projectType?: string;
    customerRequirementSummary?: string;
  };
  pricing?: {
    formattedRange?: string;
  };
  createdAt: string;
  updatedAt?: string;
};

function normalizeQuotationLead(doc: QuotationLeadDoc): NormalizedOpsLead {
  const city = typeof doc.answers?.city === 'string' ? doc.answers.city : null;
  const bhk = typeof doc.answers?.bhk === 'string' ? doc.answers.bhk : null;
  const requirement = doc.aiSummary?.customerRequirementSummary
    || [bhk, doc.aiSummary?.projectType].filter(Boolean).join(' · ')
    || null;

  return {
    source: 'quotation',
    sourceId: doc.id,
    sourceCollection: COLLECTION,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt || null,
    name: doc.customer?.name || null,
    phone: doc.customer?.phone || doc.customer?.whatsapp || null,
    email: doc.customer?.email || null,
    category: quotationCategory(doc.moduleId, doc.projectCategory),
    projectName: doc.projectCategory || doc.moduleId || null,
    intent: doc.moduleId || null,
    requirement,
    budget: doc.aiSummary?.budget || doc.pricing?.formattedRange || null,
    location: city,
    sourceStatus: doc.status || null,
    rawSummary: pickSafeSummary(
      {
        quoteNumber: doc.quoteNumber,
        moduleId: doc.moduleId,
        leadSource: doc.leadSource,
        campaignName: doc.campaignName,
        landingPage: doc.landingPage,
        leadScore: doc.leadScore,
        bhk,
        city,
      },
      ['quoteNumber', 'moduleId', 'leadSource', 'campaignName', 'landingPage', 'leadScore', 'bhk', 'city'],
    ),
  };
}

function buildQuery(filters: Omit<AdapterQueryFilters, 'limit'>) {
  return buildDateRangeQuery(filters.dateFrom, filters.dateTo);
}

export const quotationAdapter: LeadSourceAdapter = {
  source: 'quotation',
  collection: COLLECTION,
  async fetchLeads(db, filters) {
    const query = buildQuery(filters);
    const docs = (await db
      .collection(COLLECTION)
      .find(query, {
        projection: {
          _id: 0,
          id: 1,
          quoteNumber: 1,
          moduleId: 1,
          projectCategory: 1,
          leadSource: 1,
          campaignName: 1,
          landingPage: 1,
          status: 1,
          leadScore: 1,
          customer: 1,
          answers: 1,
          aiSummary: 1,
          pricing: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      })
      .sort({ createdAt: -1 })
      .limit(filters.limit)
      .toArray()) as QuotationLeadDoc[];

    return docs
      .map(normalizeQuotationLead)
      .filter((lead) => matchesLeadSearch(lead, filters.search));
  },
  async fetchLeadById(db, id) {
    const doc = (await db.collection(COLLECTION).findOne(
      { id },
      {
        projection: {
          _id: 0,
          id: 1,
          quoteNumber: 1,
          moduleId: 1,
          projectCategory: 1,
          leadSource: 1,
          campaignName: 1,
          landingPage: 1,
          status: 1,
          leadScore: 1,
          customer: 1,
          answers: 1,
          aiSummary: 1,
          pricing: 1,
          timeline: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    )) as QuotationLeadDoc | null;
    return doc ? normalizeQuotationLead(doc) : null;
  },
  async countLeads(db, filters) {
    const query = buildQuery(filters);
    const docs = (await db
      .collection(COLLECTION)
      .find(query, {
        projection: {
          _id: 0,
          id: 1,
          moduleId: 1,
          projectCategory: 1,
          customer: 1,
          answers: 1,
          aiSummary: 1,
          pricing: 1,
          createdAt: 1,
        },
      })
      .sort({ createdAt: -1 })
      .limit(2000)
      .toArray()) as QuotationLeadDoc[];
    if (!filters.search) return docs.length;
    return docs.map(normalizeQuotationLead).filter((lead) => matchesLeadSearch(lead, filters.search)).length;
  },
};
