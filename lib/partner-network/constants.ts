export const PARTNER_COLLECTIONS = {
  PARTNERS: 'partner_network_partners',
  LEADS: 'partner_network_leads',
  COMMISSIONS: 'partner_network_commissions',
  PAYMENTS: 'partner_network_payments',
  ACTIVITY: 'partner_network_activity_logs',
  SETTINGS: 'partner_network_settings',
  OTP: 'partner_network_otp_sessions',
  MANAGERS: 'partner_network_managers',
} as const;

export const PARTNER_STATUSES = ['pending', 'approved', 'rejected', 'suspended'] as const;
export const REGISTRATION_STATUSES = ['incomplete', 'complete'] as const;
export const LEAD_STATUSES = [
  'registered',
  'qualified',
  'site_visit',
  'quotation',
  'negotiation',
  'won',
  'execution',
  'completed',
  'reward_released',
] as const;

export const COMMISSION_STATUSES = ['pending', 'approved', 'paid'] as const;
export const COMMISSION_TYPES = ['fixed', 'percentage'] as const;

export const DEFAULT_TRUST_COUNTERS = {
  growingPartnerNetwork: 150,
  interiorProjects: 500,
  rentalInteriorExpertise: 200,
  aiPoweredConsultation: 1000,
  customerSatisfaction: 98,
  mumbaiCoverage: 100,
  thaneCoverage: 85,
  naviMumbaiCoverage: 90,
};

export const TRUST_COUNTER_LABELS: Record<string, string> = {
  growingPartnerNetwork: 'Growing Partner Network',
  interiorProjects: 'Interior Projects',
  rentalInteriorExpertise: 'Rental Interior Expertise',
  aiPoweredConsultation: 'AI Powered Consultation',
  customerSatisfaction: 'Customer Satisfaction',
  mumbaiCoverage: 'Mumbai Coverage',
  thaneCoverage: 'Thane Coverage',
  naviMumbaiCoverage: 'Navi Mumbai Coverage',
};
