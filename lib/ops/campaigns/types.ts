export type WaCampaignStatus =
  | 'draft'
  | 'queued'
  | 'scheduled'
  | 'running'
  | 'waiting_for_delivery'
  | 'retrying'
  | 'paused'
  | 'completed'
  | 'completed_with_failures'
  | 'cancelled'
  | 'failed';

export type WaCampaignRecipientStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'skipped_opt_out'
  | 'skipped_invalid';

export type OpsWaCampaign = {
  id: string;
  name: string;
  templateName: string;
  languageCode: string;
  bodyValues: string[];
  audience: {
    source: 'manual_phones' | 'ops_prospects' | 'ops_leads';
    phones?: string[];
    prospectType?: string;
    leadSource?: string;
  };
  status: WaCampaignStatus;
  scheduledFor?: string;
  throttlePerMinute: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  stats: {
    total: number;
    queued: number;
    sent: number;
    failed: number;
    skipped: number;
    delivered?: number;
    read?: number;
    retrying?: number;
    permanentFailure?: number;
    temporaryFailure?: number;
  };
  deliveryStats?: Record<string, number>;
};

export type OpsWaCampaignRecipient = {
  id: string;
  campaignId: string;
  phone: string;
  normalizedPhone: string;
  status: WaCampaignRecipientStatus;
  /** Explicit delivery state machine — source of truth when present */
  deliveryState?: string;
  providerMessageId?: string;
  lastError?: string;
  attemptCount?: number;
  failureClass?: string | null;
  failureReason?: string | null;
  nextRetryAt?: string | null;
  currentAttemptId?: string | null;
  doNotContact?: boolean;
  reviewRequired?: boolean;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
};
