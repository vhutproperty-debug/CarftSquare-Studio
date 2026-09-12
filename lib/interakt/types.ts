import type { OpsLeadSource } from '@/lib/ops/leads/types';

/** Provider event type strings documented by Interakt. */
export type InteraktWebhookEventType =
  | 'message_received'
  | 'message_api_sent'
  | 'message_api_delivered'
  | 'message_api_read'
  | 'message_api_failed'
  | 'message_api_clicked'
  | string;

export type InteraktMessageDirection = 'inbound' | 'outbound';

export type InteraktMessageStatus =
  | 'received'
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

export type InteraktMatchStatus =
  | 'unmatched'
  | 'matched'
  | 'ambiguous'
  | 'manually_linked';

export type InteraktEntityType =
  | 'ops_prospect'
  | 'ops_supply_record'
  | 'ops_lead'
  | 'ops_demand_record';

export type InteraktMatchField =
  | 'phone'
  | 'alternatePhone'
  | 'normalizedOwnerMobile'
  | 'lead.phone'
  | 'lead.mobile'
  | 'demand.normalizedPhone';

export type InteraktLinkCandidate = {
  entityType: InteraktEntityType;
  entityId: string;
  source?: OpsLeadSource;
  sourceCollection?: string;
  matchField: InteraktMatchField;
  confidence: 'exact';
  label?: string;
  personKey: string;
};

export type InteraktWebhookProcessingStatus =
  | 'accepted'
  | 'processed'
  | 'ignored'
  | 'failed';

/** Loose provider payload — keep separate from CraftSquare domain types. */
export type InteraktProviderCustomer = {
  id?: string;
  channel_phone_number?: string;
  phone_number?: string;
  traits?: Record<string, unknown>;
};

export type InteraktProviderMessage = {
  id?: string;
  chat_message_type?: string;
  channel_failure_reason?: string | null;
  message_status?: string;
  received_at_utc?: string | null;
  delivered_at_utc?: string | null;
  seen_at_utc?: string | null;
  campaign_id?: string | null;
  is_template_message?: boolean;
  raw_template?: string | null;
  channel_error_code?: string | null;
  message_content_type?: string;
  media_url?: string | null;
  message?: string | null;
  meta_data?: {
    source?: string;
    source_data?: {
      callback_data?: string;
    };
  };
};

export type InteraktProviderWebhookBody = {
  version?: string;
  timestamp?: string;
  type?: string;
  field?: string;
  data?: {
    customer?: InteraktProviderCustomer;
    message?: InteraktProviderMessage;
    [key: string]: unknown;
  };
};

export type InteraktWebhookEvent = {
  id: string;
  provider: 'interakt';
  eventType: string;
  providerEventKey: string;
  providerMessageId: string | null;
  providerCustomerId: string | null;
  webhookTimestamp: string | null;
  receivedAt: string;
  signatureValid: boolean;
  processingStatus: InteraktWebhookProcessingStatus;
  processingError: string | null;
  processedAt: string | null;
  rawPayload: InteraktProviderWebhookBody;
  payloadHash: string;
};

export type InteraktMediaRef = {
  url?: string;
  mimeType?: string;
  fileName?: string;
  mediaUrl?: string;
};

export type InteraktStatusTimestamps = {
  receivedAt?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  failedAt?: string;
};

export type InteraktConversation = {
  id: string;
  provider: 'interakt';
  providerCustomerId: string | null;
  customerWaE164: string;
  normalizedPhone: string;
  businessWaNumber: string;
  matchStatus: InteraktMatchStatus;
  primaryLink: InteraktLinkCandidate | null;
  candidateLinks: InteraktLinkCandidate[];
  lastMessageAt: string | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
};

export type InteraktMessage = {
  id: string;
  conversationId: string;
  providerMessageId: string;
  providerCustomerId: string | null;
  direction: InteraktMessageDirection;
  messageType: string;
  bodyText: string | null;
  media: InteraktMediaRef | null;
  status: InteraktMessageStatus;
  statusTimestamps: InteraktStatusTimestamps;
  failure: { reason?: string; channelErrorCode?: string } | null;
  callbackData: string | null;
  normalizedPhone: string;
  businessWaNumber: string;
  rawMessage: InteraktProviderMessage;
  rawEventType: string;
  createdAt: string;
  updatedAt: string;
};

export type IdentityMatchResult = {
  matchStatus: Exclude<InteraktMatchStatus, 'manually_linked'>;
  primaryLink: InteraktLinkCandidate | null;
  candidateLinks: InteraktLinkCandidate[];
};
