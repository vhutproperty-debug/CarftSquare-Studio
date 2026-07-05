import type { AurisIntentId, AurisPossessionId } from './constants';

export type AurisSerenityLeadStatus = 'new' | 'contacted' | 'qualified' | 'closed';

export type AurisUtmParams = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
};

export type AurisSerenityLead = {
  id: string;
  name: string;
  mobile: string;
  selectedIntent: AurisIntentId | string;
  possessionTimeline: AurisPossessionId | string;
  source: string;
  pagePath: string;
  referrer: string;
  utm: AurisUtmParams;
  status: AurisSerenityLeadStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};
