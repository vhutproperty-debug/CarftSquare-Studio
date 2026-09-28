export type MetaAdsCreativeStatus = 'draft' | 'approved' | 'rejected' | 'published';

export type MetaAdsCampaignRecordStatus =
  | 'draft'
  | 'ready'
  | 'publishing'
  | 'paused_on_meta'
  | 'awaiting_ads_token'
  | 'failed'
  | 'cancelled';

export type MetaAdsCreative = {
  id: string;
  offer: string;
  audienceHint: string;
  areas: string[];
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
  angle: string;
  status: MetaAdsCreativeStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectReason?: string;
};

export type MetaAdsCampaignRecord = {
  id: string;
  name: string;
  creativeId: string;
  objective: 'OUTCOME_LEADS';
  destination: 'instant_form' | 'website';
  dailyBudgetInr: number;
  status: MetaAdsCampaignRecordStatus;
  metaStatus: 'PAUSED' | 'ACTIVE' | 'NONE';
  dryRun: true;
  areas: string[];
  metaCampaignId?: string;
  metaAdSetId?: string;
  metaCreativeId?: string;
  metaAdId?: string;
  metaLeadFormId?: string;
  lastError?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
};

export type MetaAdsReadiness = {
  dryRunOnly: true;
  activeSpendAllowed: boolean;
  tokenConfigured: boolean;
  businessId: string;
  adAccountId: string;
  pageId: string;
  pixelId: string;
  graphApiVersion: string;
  permissions: string[];
  hasAdsManagement: boolean;
  hasAdsRead: boolean;
  canPublishPaused: boolean;
  blockers: string[];
  warnings: string[];
};
