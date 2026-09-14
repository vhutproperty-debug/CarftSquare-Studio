/**
 * WhatsApp delivery / recovery domain types.
 * Extends campaigns + Interakt outbound without replacing Phase 1 message model.
 */

export type DeliveryState =
  | 'QUEUED'
  | 'SUBMITTING'
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'PENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'TEMPORARY_FAILURE'
  | 'RETRY_SCHEDULED'
  | 'RETRYING'
  | 'PERMANENT_FAILURE'
  | 'CANCELLED'
  | 'UNKNOWN';

export type FailureClass = 'RETRYABLE' | 'PERMANENT' | 'UNKNOWN';

export type DeliveryEventSource =
  | 'campaign_worker'
  | 'retry_worker'
  | 'interakt_webhook'
  | 'reconcile'
  | 'ops_manual'
  | 'system';

export type DeliveryCampaignLifecycle =
  | 'draft'
  | 'queued'
  | 'scheduled'
  | 'running'
  | 'waiting_for_delivery'
  | 'retrying'
  | 'completed'
  | 'completed_with_failures'
  | 'cancelled'
  | 'failed';

export type DeliveryAttempt = {
  id: string;
  campaignId: string;
  recipientId: string;
  craftSquareMessageId?: string;
  attemptNumber: number;
  providerMessageId: string | null;
  normalizedPhone: string;
  templateName: string;
  languageCode: string;
  bodyValues: string[];
  submitIdempotencyKey: string;
  submittedAt: string | null;
  apiResponse: unknown;
  providerStatus: string | null;
  deliveryState: DeliveryState;
  failureCode: string | null;
  failureReason: string | null;
  failureClass: FailureClass | null;
  nextRetryAt: string | null;
  completedAt: string | null;
  callbackData: string;
  createdAt: string;
  updatedAt: string;
};

export type DeliveryTransition = {
  id: string;
  campaignId: string;
  recipientId: string;
  attemptId?: string;
  previousState: DeliveryState | null;
  newState: DeliveryState;
  timestamp: string;
  eventSource: DeliveryEventSource;
  providerMessageId?: string | null;
  providerEventId?: string | null;
  reason?: string | null;
  retryAttempt?: number | null;
  metadata?: Record<string, unknown>;
};

export type DeliveryRetryJob = {
  id: string;
  campaignId: string;
  recipientId: string;
  attemptId: string;
  normalizedPhone: string;
  scheduledFor: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'skipped';
  attemptNumber: number;
  maxAttempts: number;
  idempotencyKey: string;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
  claimedAt?: string | null;
  completedAt?: string | null;
};

export type DeliveryStats = {
  total: number;
  queued: number;
  submitting: number;
  submitted: number;
  pending: number;
  sent: number;
  delivered: number;
  read: number;
  temporaryFailure: number;
  retryScheduled: number;
  retrying: number;
  permanentFailure: number;
  cancelled: number;
  unknown: number;
  skipped: number;
  terminal: number;
  nonTerminal: number;
};

export const TERMINAL_DELIVERY_STATES: DeliveryState[] = [
  'DELIVERED',
  'READ',
  'PERMANENT_FAILURE',
  'CANCELLED',
];

export const NON_TERMINAL_DELIVERY_STATES: DeliveryState[] = [
  'QUEUED',
  'SUBMITTING',
  'SUBMITTED',
  'ACCEPTED',
  'PENDING',
  'SENT',
  'TEMPORARY_FAILURE',
  'RETRY_SCHEDULED',
  'RETRYING',
  'UNKNOWN',
];
