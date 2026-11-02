export const DEVELOPER_PROJECTS_COLLECTION = 'ops_developer_projects';
export const RESALE_PROJECTS_COLLECTION = 'ops_resale_projects';
export const RESALE_UNITS_COLLECTION = 'ops_resale_units';

export const DEVELOPER_STATUSES = [
  'new_launch',
  'under_construction',
  'ready',
  'sold_out',
  'other',
] as const;

export type DeveloperProjectStatus = (typeof DEVELOPER_STATUSES)[number];

export const DEVELOPER_STATUS_LABELS: Record<DeveloperProjectStatus, string> = {
  new_launch: 'New launch',
  under_construction: 'Under construction',
  ready: 'Ready',
  sold_out: 'Sold out',
  other: 'Other',
};

export const CHANNEL_PARTNER_STATUSES = ['not_approached', 'applied', 'empanelled'] as const;
export type ChannelPartnerStatus = (typeof CHANNEL_PARTNER_STATUSES)[number];

export const CHANNEL_PARTNER_LABELS: Record<ChannelPartnerStatus, string> = {
  not_approached: 'Not approached',
  applied: 'Applied',
  empanelled: 'Empanelled',
};

export const RESALE_UNIT_STATUSES = [
  'for_sale',
  'for_rent',
  'available',
  'follow_up',
  'under_offer',
  'sold',
  'rented',
] as const;
export type ResaleUnitStatus = (typeof RESALE_UNIT_STATUSES)[number];

export const RESALE_UNIT_STATUS_LABELS: Record<ResaleUnitStatus, string> = {
  for_sale: 'For sale',
  for_rent: 'For rent',
  available: 'Available',
  follow_up: 'Follow-up',
  under_offer: 'Under offer',
  sold: 'Sold',
  rented: 'Rented',
};

export const RESALE_PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'] as const;
export type ResalePriority = (typeof RESALE_PRIORITIES)[number] | '';

export const LISTING_TYPES = ['resale', 'rental'] as const;
export type ResaleListingType = (typeof LISTING_TYPES)[number];

export const LISTING_TYPE_LABELS: Record<ResaleListingType, string> = {
  resale: 'Resale',
  rental: 'Rental',
};

export const PRICE_BANDS = [
  { id: 'under_3', label: 'Under ₹3 Cr', min: 0, max: 3 },
  { id: '3_5', label: '₹3–5 Cr', min: 3, max: 5 },
  { id: '5_8', label: '₹5–8 Cr', min: 5, max: 8 },
  { id: 'above_8', label: 'Above ₹8 Cr', min: 8, max: Number.POSITIVE_INFINITY },
] as const;

export type PriceBandId = (typeof PRICE_BANDS)[number]['id'] | '';

export type ProjectContact = {
  name: string;
  role: string;
  phone: string;
  email: string;
};

/** Public developer-desk detail. Verification is a team check, not a privacy flag. */
export type SalesOfficeField = {
  value: string;
  verification: 'verified' | 'unverified';
  note: string;
};

export type FloorPlan = {
  id: string;
  name: string;
  url: string;
  kind: 'image' | 'pdf';
};

export type DeveloperProject = {
  id: string;
  slug: string;
  name: string;
  developer: string;
  locality: string;
  address: string;
  maharera: string;
  status: DeveloperProjectStatus;
  statusLabel: string;
  configLabel: string;
  bhk: number[];
  carpetMinSqft: number | null;
  carpetMaxSqft: number | null;
  priceLabel: string;
  priceMinCrore: number | null;
  priceMaxCrore: number | null;
  pricePerSqft: number | null;
  pricePerSqftMax: number | null;
  possession: string;
  inventoryNote: string;
  offerNote: string;
  channelPartnerStatus: ChannelPartnerStatus;
  usps: string[];
  amenities: string[];
  floorPlans: FloorPlan[];
  brochureUrl: string;
  salesEmail: SalesOfficeField;
  cpEmail: SalesOfficeField;
  salesPhone: SalesOfficeField;
  contacts: ProjectContact[];
  notes: string;
  sourceLinks: string[];
  lastUpdatedBy: string;
  lastUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ResaleProject = {
  id: string;
  slug: string;
  name: string;
  developer: string;
  locality: string;
  towers: string[];
  maharera: string;
  notes: string;
  sourceLinks: string[];
  usps: string[];
  amenities: string[];
  focus: 'resale';
  lastUpdatedBy: string;
  lastUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
};

/** Owner and flat number are admin-only. They are omitted before a response leaves the server. */
export type ResaleOwner = {
  name: string;
  phone: string;
  email: string;
  whatsapp: string;
};

export type ResaleFollowUp = {
  id: string;
  at: string;
  by: string;
  note: string;
  source: 'import' | 'ops';
};

export type ResaleUnit = {
  id: string;
  slug: string;
  projectSlug: string;
  projectName: string;
  tower: string;
  /** Exact flat id. Omitted for non-admin roles. */
  unitNumber: string;
  /** Exact floor. Omitted for non-admin roles; they see floorBand. */
  floor: string;
  bhk: number | null;
  carpetSqft: number | null;
  floorBand: string;
  configLabel: string;
  askingPriceCrore: number | null;
  askingPriceLabel: string;
  offerTag: string;
  status: ResaleUnitStatus;
  listingType: ResaleListingType;
  owner: ResaleOwner;
  intent: string;
  response: string;
  nextAction: string;
  priority: ResalePriority;
  notes: string;
  campaign: string;
  asOf: string;
  followUps: ResaleFollowUp[];
  sourceLinks: string[];
  lastUpdatedBy: string;
  lastUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicResaleUnit = Omit<ResaleUnit, 'unitNumber' | 'owner' | 'floor'>;

export type DeveloperListQuery = {
  q: string;
  locality: string;
  developer: string;
  status: DeveloperProjectStatus | '';
  priceBand: PriceBandId;
  bhk: string;
};

export type ResaleListQuery = {
  q: string;
  locality: string;
  project: string;
  tower: string;
  bhk: string;
  status: ResaleUnitStatus | '';
  priceBand: PriceBandId;
  floorBand: string;
  listingType: ResaleListingType | '';
};
