export type OpsLeadSource =
  | 'homepage'
  | 'painting'
  | 'auris_serenity'
  | 'satellite_elegance'
  | 'designer_callback'
  | 'quotation'
  | 'housing_com';

export type OpsLeadCategory =
  | 'general'
  | 'painting'
  | 'interior'
  | 'rental'
  | 'quotation'
  | 'callback'
  | 'unknown';

export type NormalizedOpsLead = {
  source: OpsLeadSource;
  sourceId: string;
  sourceCollection: string;
  createdAt: string;
  updatedAt?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  category: OpsLeadCategory;
  projectName?: string | null;
  intent?: string | null;
  requirement?: string | null;
  budget?: string | number | null;
  location?: string | null;
  sourceStatus?: string | null;
  assignedTo?: string | null;
  rawSummary?: Record<string, unknown>;
};

export type OpsLeadSourceHealth = Record<OpsLeadSource, 'ok' | 'error'>;

export type OpsLeadsPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type OpsLeadsQueryResult = {
  items: NormalizedOpsLead[];
  pagination: OpsLeadsPagination;
  sourceHealth: Partial<OpsLeadSourceHealth>;
};

export type OpsDashboardStats = {
  totalLeads: number;
  leadsToday: number;
  leadsLast7Days: number;
  sourceBreakdown: Record<OpsLeadSource, number>;
  latestLeads: NormalizedOpsLead[];
  sourceHealth: Partial<OpsLeadSourceHealth>;
};

export const OPS_LEAD_SOURCES: OpsLeadSource[] = [
  'homepage',
  'painting',
  'auris_serenity',
  'satellite_elegance',
  'designer_callback',
  'quotation',
  'housing_com',
];

export const OPS_LEAD_SOURCE_LABELS: Record<OpsLeadSource, string> = {
  homepage: 'Homepage',
  painting: 'Painting',
  auris_serenity: 'Auris Serenity',
  satellite_elegance: 'Satellite Elegance',
  designer_callback: 'Designer Callback',
  quotation: 'AI Quotation',
  housing_com: 'Housing.com',
};

export const OPS_LEAD_CATEGORY_LABELS: Record<OpsLeadCategory, string> = {
  general: 'General',
  painting: 'Painting',
  interior: 'Interior',
  rental: 'Rental',
  quotation: 'Quotation',
  callback: 'Callback',
  unknown: 'Unknown',
};

export function isOpsLeadSource(value: string): value is OpsLeadSource {
  return OPS_LEAD_SOURCES.includes(value as OpsLeadSource);
}
