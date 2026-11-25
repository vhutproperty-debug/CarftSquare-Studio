export type PropertiesUtmParams = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
};

export type PropertiesLeadConsent = {
  given: true;
  text: string;
  version: string;
  channels: string[];
  timestamp: string;
  ip: string;
  userAgent: string;
  pagePath: string;
};

export type PropertiesLead = {
  id: string;
  name: string;
  mobile: string;
  email: string;
  intent: string;
  intentLabel: string;
  area: string;
  budget: string;
  message: string;
  brand: string;
  source: string;
  pagePath: string;
  referrer: string;
  utm: PropertiesUtmParams;
  ip: string;
  userAgent: string;
  consent: PropertiesLeadConsent;
  status: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};
