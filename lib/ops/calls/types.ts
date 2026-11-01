import type { CallActivityStatus, CallDisplayStatus } from '@/lib/ops/calls/statuses';
import type { OpsLeadSource } from '@/lib/ops/leads/types';

export type CallTargetType = 'unified_lead' | 'ops_prospect';

export type ProspectType =
  | 'homeowner'
  | 'rental_owner'
  | 'buyer'
  | 'tenant'
  | 'interior_prospect'
  | 'broker'
  | 'unknown';

export type ProspectSource =
  | 'manual'
  | 'csv_import'
  | 'existing_database'
  | 'referral'
  | 'other';

/** P1–P4 owner priority. Intl is the international-owner bucket from builder lists. */
export type ProspectPriority = 'P1' | 'P2' | 'P3' | 'P4' | 'Intl';

export type ProspectIntent = 'sell' | 'rent' | 'interiors' | 'not_now';

export type OpsProspect = {
  id: string;
  name?: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  prospectType: ProspectType;
  projectName?: string;
  building?: string;
  unit?: string;
  location?: string;
  requirement?: string;
  notes?: string;
  /** Optional structured listing fields. Older prospects omit these and are parsed from requirement text. */
  bhk?: string;
  budget?: string;
  budgetMin?: string;
  budgetMax?: string;
  furnishing?: string;
  floor?: string;
  expectedRent?: string;
  expectedSalePrice?: string;
  listingType?: 'rent' | 'sale';
  source: ProspectSource;
  assignedTo?: string;
  callStatus: CallDisplayStatus;
  nextFollowUpAt?: string;
  phoneInvalid?: boolean;
  priority?: ProspectPriority;
  wave?: number;
  batch?: string;
  campaignTag?: string;
  unitCount?: number;
  salutation?: string;
  /** WhatsApp STOP / Stop messages. Campaigns must skip these. */
  optOut?: boolean;
  /** Call or WhatsApp do-not-contact. Campaigns must skip these. */
  doNotContact?: boolean;
  lastButtonReply?: string;
  intent?: ProspectIntent;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type OpsCallActivity = {
  id: string;
  targetType: CallTargetType;
  targetSource?: string;
  targetId: string;
  phone: string;
  status: CallActivityStatus;
  note?: string;
  nextFollowUpAt?: string;
  calledBy: string;
  calledByEmail?: string;
  calledByName?: string;
  createdAt: string;
};

export type CallTargetSummary = {
  currentStatus: CallDisplayStatus;
  lastCalledAt?: string | null;
  lastCalledBy?: string | null;
  lastCalledByName?: string | null;
  nextFollowUpAt?: string | null;
  doNotCall: boolean;
  wrongNumber: boolean;
  activityCount: number;
};

export type CallQueueItem = {
  id: string;
  kind: 'unified_lead' | 'ops_prospect';
  name?: string | null;
  phone?: string | null;
  projectName?: string | null;
  building?: string | null;
  prospectType?: ProspectType | null;
  leadSource?: OpsLeadSource | null;
  priority?: ProspectPriority | null;
  wave?: number | null;
  batch?: string | null;
  campaignTag?: string | null;
  intent?: ProspectIntent | null;
  salutation?: string | null;
  unit?: string | null;
  assignedTo?: string | null;
  assignedToName?: string | null;
  callStatus: CallDisplayStatus;
  lastCalledAt?: string | null;
  nextFollowUpAt?: string | null;
  doNotCall: boolean;
  wrongNumber: boolean;
  href: string;
  queueRank: number;
};

export type CallWorkspaceMetrics = {
  callsDueToday: number;
  overdueFollowUps: number;
  notCalled: number;
  interested: number;
  callsLoggedToday: number;
};

export type CallQueueSection = {
  id: string;
  label: string;
  items: CallQueueItem[];
};
