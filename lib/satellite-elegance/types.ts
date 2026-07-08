import type { SatelliteIntentId, SatellitePossessionId } from './constants';

export type SatelliteEleganceLeadStatus = 'new' | 'contacted' | 'qualified' | 'closed';

export type SatelliteUtmParams = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
};

export type SatelliteEleganceLead = {
  id: string;
  name: string;
  mobile: string;
  selectedIntent: SatelliteIntentId | string;
  possessionTimeline: SatellitePossessionId | string;
  source: string;
  pagePath: string;
  referrer: string;
  utm: SatelliteUtmParams;
  status: SatelliteEleganceLeadStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};
