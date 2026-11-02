export const OUTREACH_COLLECTION = 'outreach_contacts';
export const OUTREACH_TEMPLATES_COLLECTION = 'outreach_templates';
export const OUTREACH_APPROVALS_COLLECTION = 'outreach_wave_approvals';

export const OUTREACH_AUDIENCES = [
  'owner_sell',
  'owner_rent',
  'tenant_buy',
  'tenant_renew',
  'nri_owner',
] as const;
export type OutreachAudience = (typeof OUTREACH_AUDIENCES)[number];

export const OUTREACH_AUDIENCE_LABELS: Record<OutreachAudience, string> = {
  owner_sell: 'Owners selling',
  owner_rent: 'Owners renting',
  tenant_buy: 'Tenants buying',
  tenant_renew: 'Tenants renewing',
  nri_owner: 'NRI owners',
};

export const OUTREACH_STATUSES = [
  'not_contacted',
  'message_sent',
  'delivered',
  'replied',
  'interested',
  'not_interested',
  'do_not_contact',
  'wrong_number',
] as const;
export type OutreachStatus = (typeof OUTREACH_STATUSES)[number];

export const OUTREACH_STATUS_LABELS: Record<OutreachStatus, string> = {
  not_contacted: 'Not contacted',
  message_sent: 'Message sent',
  delivered: 'Delivered',
  replied: 'Replied',
  interested: 'Interested',
  not_interested: 'Not interested',
  do_not_contact: 'Do not contact',
  wrong_number: 'Wrong number',
};

export const OUTREACH_ROLES = ['owner', 'tenant'] as const;
export type OutreachRole = (typeof OUTREACH_ROLES)[number];

export type OutreachHistoryEntry = {
  id: string;
  at: string;
  by: string;
  kind: 'status' | 'note' | 'approval';
  fromStatus?: string;
  toStatus?: string;
  note: string;
};

export type OutreachContact = {
  id: string;
  audience: OutreachAudience;
  wave: string;
  priority: string;
  project: string;
  tower: string;
  floor: string;
  bhk: string;
  flats: string[];
  name: string;
  role: OutreachRole;
  phone_e164: string;
  email: string;
  signal: string;
  lease_end: string;
  already_contacted: boolean;
  status: OutreachStatus;
  notes: string;
  message: string;
  history: OutreachHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  lastUpdatedBy: string;
};

export type OutreachTemplate = {
  audience: OutreachAudience;
  body: string;
  updatedAt: string;
  updatedBy: string;
};

export type OutreachApproval = {
  id: string;
  audience: OutreachAudience | '';
  wave: string;
  approvedBy: string;
  approvedAt: string;
  note: string;
};

export type OutreachListQuery = {
  audience: OutreachAudience | '';
  wave: string;
  project: string;
  tower: string;
  status: OutreachStatus | '';
  q: string;
};
