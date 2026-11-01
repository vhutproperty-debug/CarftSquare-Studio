export const BROKER_CRM_STATUSES = [
  'new',
  'contacted',
  'active',
  'dormant',
  'do-not-contact',
] as const;

export type BrokerCrmStatus = (typeof BROKER_CRM_STATUSES)[number];

export const BROKER_CRM_STATUS_LABELS: Record<BrokerCrmStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  active: 'Active',
  dormant: 'Dormant',
  'do-not-contact': 'Do not contact',
};

export function isBrokerCrmStatus(value: string): value is BrokerCrmStatus {
  return (BROKER_CRM_STATUSES as readonly string[]).includes(value);
}

export type BrokerCrmIntent = 'rent' | 'buy';

export type BrokerCrmRequirement = {
  id: string;
  bhk: string;
  budgetBandId: string;
  area: string;
  project: string;
  intent: BrokerCrmIntent;
  active: boolean;
  updatedAt: string;
};

export type OpsBrokerCrmRecord = {
  id: string;
  phone: string;
  name: string;
  /** True after an operator renames the broker. Import will not overwrite it. */
  nameEdited: boolean;
  groups: string[];
  groupCount: number;
  admin: boolean;
  derivedAreas: string[];
  derivedProjects: string[];
  areaTags: string[];
  projectTags: string[];
  status: BrokerCrmStatus;
  /** Internal ops notes. Never included in outreach export or the Market board. */
  notes: string;
  lastContactedAt: string | null;
  requirements: BrokerCrmRequirement[];
  priorityScore: number;
  doNotContact: boolean;
  doNotContactAt: string | null;
  doNotContactReason: string | null;
  source: 'whatsapp_groups';
  createdAt: string;
  updatedAt: string;
  importedAt: string | null;
};

export type BrokerCrmListItem = {
  id: string;
  phone: string;
  name: string;
  groups: string[];
  groupCount: number;
  admin: boolean;
  areas: string[];
  projects: string[];
  status: BrokerCrmStatus;
  lastContactedAt: string | null;
  priorityScore: number;
  priority: boolean;
  requirementCount: number;
  doNotContact: boolean;
};

export type BrokerCrmListQuery = {
  search?: string;
  group?: string;
  area?: string;
  status?: BrokerCrmStatus | 'all';
  priorityOnly?: boolean;
  sort?: 'priority' | 'name' | 'groupCount' | 'lastContacted';
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
};

export type BrokerCrmMetrics = {
  total: number;
  priority: number;
  admins: number;
  multiGroup: number;
  doNotContact: number;
  withRequirements: number;
};

export type BrokerCrmListResult = {
  items: BrokerCrmListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  filterOptions: {
    groups: string[];
    areas: string[];
  };
  metrics: BrokerCrmMetrics;
};

export type BrokerImportRow = {
  phoneRaw: string;
  name: string;
  groupsRaw: string;
  adminRaw: string;
};

export type BrokerCrmImportStats = {
  rows: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  dedupedInFile: number;
  priority: number;
  admins: number;
};

export const BROKER_CRM_COLLECTION = 'ops_broker_crm';
export const BROKER_CRM_WAVE_APPROVAL_COLLECTION = 'ops_broker_crm_wave_approvals';
