import type {
  COMMISSION_STATUSES,
  COMMISSION_TYPES,
  LEAD_STATUSES,
  PARTNER_STATUSES,
  REGISTRATION_STATUSES,
} from '@/lib/partner-network/constants';

export type PartnerStatus = (typeof PARTNER_STATUSES)[number];
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type CommissionStatus = (typeof COMMISSION_STATUSES)[number];
export type CommissionType = (typeof COMMISSION_TYPES)[number];

export type TrustCounters = Record<string, number>;

export type PartnerRecord = {
  id: string;
  partnerId: string;
  fullName: string;
  mobile: string;
  email: string;
  companyName: string;
  operatingAreas: string;
  projectsCovered: string;
  dealType: string;
  dealsPerMonth: string;
  whatsapp: string;
  reraNumber?: string;
  city: string;
  state: string;
  status: PartnerStatus;
  registrationStatus: RegistrationStatus;
  profileCompletionPercent: number;
  leadSource: string;
  lastActivityAt: string;
  managerId?: string;
  agreementAccepted: boolean;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  notes?: string;
};

export type PartnerLead = {
  id: string;
  leadId: string;
  partnerId: string;
  partnerRecordId: string;
  clientName: string;
  mobile: string;
  project: string;
  society: string;
  location: string;
  rentalInterior: boolean;
  homeInterior: boolean;
  budget: string;
  possessionDate: string;
  remarks: string;
  status: LeadStatus;
  managerId?: string;
  commissionAmount?: number;
  commissionType?: CommissionType;
  commissionStatus?: CommissionStatus;
  paymentRemarks?: string;
  paymentDate?: string;
  createdAt: string;
  updatedAt: string;
};

export type CommissionRecord = {
  id: string;
  partnerId: string;
  leadId: string;
  amount: number;
  type: CommissionType;
  status: CommissionStatus;
  paymentReference?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
};

export type PaymentRecord = {
  id: string;
  partnerId: string;
  commissionId: string;
  amount: number;
  paymentReference: string;
  remarks?: string;
  createdAt: string;
};

export type ActivityLog = {
  id: string;
  actorType: 'admin' | 'partner' | 'system';
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
  createdAt: string;
};

export type RelationshipManager = {
  id: string;
  name: string;
  email: string;
  mobile: string;
  active: boolean;
  createdAt: string;
};
