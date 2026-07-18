/**
 * CraftSquare /ops — Brokerage Operations OS business model.
 * Mumbai real estate brokerage. Not a generic CRM.
 *
 * UX-only definitions for Phase 2. Backend routes unchanged.
 */

export const OPS_PRODUCT = {
  name: 'CraftSquare Ops',
  tagline: 'Brokerage Operations OS',
  market: 'Mumbai Real Estate',
} as const;

export type OpsPillarId = 'demand' | 'supply' | 'revenue' | 'profit';

export const OPS_PILLARS: Record<
  OpsPillarId,
  { label: string; shortLabel: string; description: string }
> = {
  demand: {
    label: 'Demand',
    shortLabel: 'Demand',
    description: 'Customer enquiries from website, portals, ads, WhatsApp, referrals, and imports.',
  },
  supply: {
    label: 'Supply',
    shortLabel: 'Supply',
    description: 'Company-owned inventory from cold calling, owners, broker network, and referrals.',
  },
  revenue: {
    label: 'Revenue',
    shortLabel: 'Revenue',
    description: 'Rental brokerage, sale brokerage, interior referral commission, and service referrals.',
  },
  profit: {
    label: 'Profit',
    shortLabel: 'Profit',
    description: 'Billing, collections, broker payouts, executive incentives, and profitability.',
  },
};

export type PipelineStageId =
  | 'demand'
  | 'supply'
  | 'matching'
  | 'deal'
  | 'revenue'
  | 'agreement'
  | 'renewal';

export type PipelineStageStatus = 'active' | 'coming_soon';

export const OPS_PIPELINE: Array<{
  id: PipelineStageId;
  label: string;
  pillar: OpsPillarId;
  status: PipelineStageStatus;
  description: string;
  href: string;
}> = [
  {
    id: 'demand',
    label: 'Demand',
    pillar: 'demand',
    status: 'active',
    description: 'Capture and qualify customer enquiries.',
    href: '/ops/leads',
  },
  {
    id: 'supply',
    label: 'Supply',
    pillar: 'supply',
    status: 'active',
    description: 'Build company-owned inventory through outreach.',
    href: '/ops/supply',
  },
  {
    id: 'matching',
    label: 'Matching',
    pillar: 'revenue',
    status: 'active',
    description: 'Match demand requirements with available supply.',
    href: '/ops/matching',
  },
  {
    id: 'deal',
    label: 'Deal',
    pillar: 'revenue',
    status: 'active',
    description: 'Negotiate terms and close brokerage transactions.',
    href: '/ops/deals',
  },
  {
    id: 'revenue',
    label: 'Revenue',
    pillar: 'revenue',
    status: 'active',
    description: 'Track brokerage fees and referral commissions.',
    href: '/ops/revenue',
  },
  {
    id: 'agreement',
    label: 'Agreement',
    pillar: 'profit',
    status: 'active',
    description: 'Formalize agreements, billing, and collections.',
    href: '/ops/agreements',
  },
  {
    id: 'renewal',
    label: 'Renewal',
    pillar: 'profit',
    status: 'active',
    description: 'Renewals, payouts, incentives, and profitability.',
    href: '/ops/renewals',
  },
];

/** Future demand channels — maps to live adapters where connected today. */
export const DEMAND_CHANNELS = [
  { id: 'craftsquare_website', label: 'CraftSquare Website', live: true },
  { id: 'housing_com', label: 'Housing.com', live: true },
  { id: '99acres', label: '99acres', live: false },
  { id: 'magicbricks', label: 'MagicBricks', live: false },
  { id: 'meta_ads', label: 'Meta Ads', live: false },
  { id: 'google_ads', label: 'Google Ads', live: false },
  { id: 'whatsapp', label: 'WhatsApp', live: false },
  { id: 'referrals', label: 'Referrals', live: false },
  { id: 'manual_entry', label: 'Manual Entry', live: false },
  { id: 'csv_api_imports', label: 'CSV / API Imports', live: false },
] as const;

export const SUPPLY_METHODS = [
  { id: 'cold_calling', label: 'Cold Calling', live: true },
  { id: 'existing_owners', label: 'Existing Owners', live: false },
  { id: 'broker_network', label: 'Broker Network', live: false },
  { id: 'referrals', label: 'Referrals', live: false },
  { id: 'manual_inventory', label: 'Manual Inventory', live: true },
] as const;

export const REVENUE_STREAMS = [
  'Rental Brokerage',
  'Sale Brokerage',
  'Interior Referral Commission',
  'Future Service Referrals',
] as const;

export type OpsNavItem = {
  href?: string;
  label: string;
  pillar?: OpsPillarId;
  pipelineStage?: PipelineStageId;
  status: 'active' | 'coming_soon';
  icon: 'overview' | 'demand' | 'supply' | 'matching' | 'deal' | 'revenue' | 'agreement' | 'intelligence' | 'integrations' | 'brokers';
  exact?: boolean;
};

export const OPS_NAV_SECTIONS: Array<{
  pillar: OpsPillarId | 'overview';
  label: string;
  items: OpsNavItem[];
}> = [
  {
    pillar: 'overview',
    label: 'Primary',
    items: [
      {
        href: '/ops',
        label: 'Dashboard',
        status: 'active',
        icon: 'overview',
        exact: true,
      },
      {
        href: '/ops/leads',
        label: 'Demand',
        pillar: 'demand',
        pipelineStage: 'demand',
        status: 'active',
        icon: 'demand',
      },
      {
        href: '/ops/supply',
        label: 'Supply',
        pillar: 'supply',
        pipelineStage: 'supply',
        status: 'active',
        icon: 'supply',
      },
      {
        href: '/ops/brokers',
        label: 'Brokers',
        pillar: 'supply',
        pipelineStage: 'supply',
        status: 'active',
        icon: 'brokers',
      },
      {
        href: '/ops/matching',
        label: 'Matching',
        pillar: 'revenue',
        pipelineStage: 'matching',
        status: 'active',
        icon: 'matching',
      },
      {
        href: '/ops/deals',
        label: 'Deals',
        pillar: 'revenue',
        pipelineStage: 'deal',
        status: 'active',
        icon: 'deal',
      },
    ],
  },
  {
    pillar: 'revenue',
    label: 'Financial',
    items: [
      {
        href: '/ops/revenue',
        label: 'Revenue',
        pillar: 'revenue',
        pipelineStage: 'revenue',
        status: 'active',
        icon: 'revenue',
      },
      {
        href: '/ops/intelligence',
        label: 'Profit',
        pillar: 'profit',
        status: 'active',
        icon: 'intelligence',
      },
    ],
  },
  {
    pillar: 'profit',
    label: 'Lifecycle',
    items: [
      {
        href: '/ops/agreements',
        label: 'Agreements',
        pillar: 'profit',
        pipelineStage: 'agreement',
        status: 'active',
        icon: 'agreement',
      },
      {
        href: '/ops/renewals',
        label: 'Renewals',
        pillar: 'profit',
        pipelineStage: 'renewal',
        status: 'active',
        icon: 'agreement',
      },
    ],
  },
  {
    pillar: 'demand',
    label: 'Integrations & tools',
    items: [
      {
        href: '/ops/integrations/housing',
        label: 'Housing.com',
        pillar: 'demand',
        pipelineStage: 'demand',
        status: 'active',
        icon: 'integrations',
      },
      {
        href: '/ops/calls',
        label: 'Calls',
        pillar: 'supply',
        pipelineStage: 'supply',
        status: 'active',
        icon: 'supply',
      },
    ],
  },
];

export function getRecordBusinessType(kind: 'unified_lead' | 'ops_prospect'): {
  pillar: OpsPillarId;
  label: string;
  pipelineStage: PipelineStageId;
} {
  if (kind === 'unified_lead') {
    return { pillar: 'demand', label: 'Demand Enquiry', pipelineStage: 'demand' };
  }
  return { pillar: 'supply', label: 'Supply Prospect', pipelineStage: 'supply' };
}
