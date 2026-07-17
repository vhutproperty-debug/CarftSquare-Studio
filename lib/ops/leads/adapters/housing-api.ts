import type { NormalizedOpsLead } from '@/lib/ops/leads/types';
import type { AdapterQueryFilters, LeadSourceAdapter } from '@/lib/ops/leads/adapters/shared';
import {
  matchesLeadSearch,
  pickSafeSummary,
} from '@/lib/ops/leads/normalize';
import {
  HOUSING_RAW_COLLECTION,
  HOUSING_SOURCE,
  type OpsHousingRawRecord,
} from '@/lib/ops/integrations/housing/housing.types';

export function housingRawToLead(doc: OpsHousingRawRecord): NormalizedOpsLead {
  const n = doc.normalized;
  const requirement = [n.buyRent, n.configuration, n.propertyType, n.area, n.message]
    .filter(Boolean)
    .join(' · ') || null;
  const location = [n.locality, n.city].filter(Boolean).join(', ') || null;

  return {
    source: HOUSING_SOURCE,
    sourceId: doc.id,
    sourceCollection: HOUSING_RAW_COLLECTION,
    createdAt: n.leadDate || doc.importedAt || doc.fetchedAt,
    updatedAt: doc.updatedAt,
    name: n.customerName || null,
    phone: n.mobile || null,
    email: n.email || null,
    category: n.buyRent?.toLowerCase().includes('rent') ? 'rental' : 'general',
    projectName: n.project || null,
    requirement,
    budget: n.budget || null,
    location,
    sourceStatus: n.status || null,
    assignedTo: n.assignedTo || null,
    rawSummary: pickSafeSummary(doc.payload, [
      'project_name',
      'locality_name',
      'city_name',
      'category_type',
      'service_type',
      'min_price',
      'max_price',
    ]),
  };
}

function buildQuery(filters: Omit<AdapterQueryFilters, 'limit'>) {
  const query: Record<string, unknown> = { syncState: 'imported' };
  if (filters.dateFrom || filters.dateTo) {
    const range: Record<string, string> = {};
    if (filters.dateFrom) range.$gte = filters.dateFrom;
    if (filters.dateTo) range.$lte = filters.dateTo;
    query.importedAt = range;
  }
  return query;
}

export const housingApiAdapter: LeadSourceAdapter = {
  source: HOUSING_SOURCE,
  collection: HOUSING_RAW_COLLECTION,
  async fetchLeads(db, filters) {
    const query = buildQuery(filters);
    const docs = (await db
      .collection(HOUSING_RAW_COLLECTION)
      .find(query, { projection: { _id: 0 } })
      .sort({ 'normalized.leadDate': -1, updatedAt: -1 })
      .limit(filters.limit)
      .toArray()) as unknown as OpsHousingRawRecord[];

    return docs
      .map(housingRawToLead)
      .filter((lead) => matchesLeadSearch(lead, filters.search));
  },
  async fetchLeadById(db, id) {
    const doc = (await db.collection(HOUSING_RAW_COLLECTION).findOne(
      { id, syncState: 'imported' },
      { projection: { _id: 0 } },
    )) as unknown as OpsHousingRawRecord | null;
    return doc ? housingRawToLead(doc) : null;
  },
  async countLeads(db, filters) {
    const query = buildQuery(filters);
    const docs = (await db
      .collection(HOUSING_RAW_COLLECTION)
      .find(query, { projection: { _id: 0, id: 1, normalized: 1 } })
      .sort({ updatedAt: -1 })
      .limit(2000)
      .toArray()) as unknown as OpsHousingRawRecord[];

    if (!filters.search) return docs.length;
    return docs.map(housingRawToLead).filter((lead) => matchesLeadSearch(lead, filters.search)).length;
  },
};
