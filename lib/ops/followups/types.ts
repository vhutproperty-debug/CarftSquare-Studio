export type FollowUpJobStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'retrying';

export type FollowUpTargetType =
  | 'ops_prospect'
  | 'ops_supply_record'
  | 'ops_lead'
  | 'interakt_conversation';

export type OpsFollowUpJob = {
  id: string;
  targetType: FollowUpTargetType;
  targetId: string;
  targetSource?: string;
  phone: string;
  normalizedPhone: string;
  conversationId?: string;
  templateName: string;
  languageCode: string;
  bodyValues: string[];
  scheduledFor: string;
  status: FollowUpJobStatus;
  attempt: number;
  maxAttempts: number;
  lastError?: string;
  providerMessageId?: string;
  idempotencyKey: string;
  createdBy: string;
  cancelledAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};
