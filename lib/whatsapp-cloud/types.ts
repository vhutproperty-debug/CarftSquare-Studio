import type { OpsLeadSource } from '@/lib/ops/leads/types';

/** Provider event type strings documented by Wa. */
export type WaWebhookEventType =
  | 'message_received'
  | 'message_api_sent'
  | 'message_api_delivered'
  | 'message_api_read'
  | 'message_api_failed'
  | 'message_api_clicked'
  | string;

export type WaMessageDirection = 'inbound' | 'outbound';

export type WaMessageStatus =
  | 'received'
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

export type WaMatchStatus =
  | 'unmatched'
  | 'matched'
  | 'ambiguous'
  | 'manually_linked';

export type WaEntityType =
  | 'ops_prospect'
  | 'ops_supply_record'
  | 'ops_lead'
  | 'ops_demand_record';

export type WaMatchField =
  | 'phone'
  | 'alternatePhone'
  | 'normalizedOwnerMobile'
  | 'lead.phone'
  | 'lead.mobile'
  | 'demand.normalizedPhone';

export type WaLinkCandidate = {
  entityType: WaEntityType;
  entityId: string;
  source?: OpsLeadSource;
  sourceCollection?: string;
  matchField: WaMatchField;
  confidence: 'exact';
  label?: string;
  personKey: string;
};

export type WaWebhookProcessingStatus =
  | 'accepted'
  | 'processed'
  | 'ignored'
  | 'failed';

/** Loose provider payload — keep separate from CraftSquare domain types. */
export type WaProviderCustomer = {
  id?: string;
  channel_phone_number?: string;
  phone_number?: string;
  traits?: Record<string, unknown>;
};

export type WaProviderMessage = {
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
  media_id?: string | null;
  mime?: string | null;
  filename?: string | null;
  message?: string | null;
  meta_data?: {
    source?: string;
    source_data?: {
      callback_data?: string;
    };
  };
};

export type WaProviderWebhookBody = {
  version?: string;
  timestamp?: string;
  type?: string;
  field?: string;
  data?: {
    customer?: WaProviderCustomer;
    message?: WaProviderMessage;
    [key: string]: unknown;
  };
};

export type WaWebhookEvent = {
  id: string;
  provider: 'whatsapp_cloud' | 'legacy';
  eventType: string;
  providerEventKey: string;
  providerMessageId: string | null;
  providerCustomerId: string | null;
  webhookTimestamp: string | null;
  receivedAt: string;
  signatureValid: boolean;
  processingStatus: WaWebhookProcessingStatus;
  processingError: string | null;
  processedAt: string | null;
  rawPayload: unknown;
  payloadHash: string;
};

export type WaMediaRef = {
  id?: string;
  url?: string;
  mimeType?: string;
  fileName?: string;
  mediaUrl?: string;
};

export type WaStatusTimestamps = {
  receivedAt?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  failedAt?: string;
};

export type WaConversation = {
  id: string;
  provider: 'whatsapp_cloud' | 'legacy';
  providerCustomerId: string | null;
  hidden?: boolean;
  customerWaE164: string;
  normalizedPhone: string;
  businessWaNumber: string;
  matchStatus: WaMatchStatus;
  primaryLink: WaLinkCandidate | null;
  candidateLinks: WaLinkCandidate[];
  lastMessageAt: string | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
};

export type WaMessage = {
  id: string;
  conversationId: string;
  providerMessageId: string;
  providerCustomerId: string | null;
  direction: WaMessageDirection;
  messageType: string;
  bodyText: string | null;
  media: WaMediaRef | null;
  status: WaMessageStatus;
  statusTimestamps: WaStatusTimestamps;
  failure: { reason?: string; channelErrorCode?: string } | null;
  callbackData: string | null;
  normalizedPhone: string;
  businessWaNumber: string;
  rawMessage: WaProviderMessage;
  rawEventType: string;
  createdAt: string;
  updatedAt: string;
};

export type IdentityMatchResult = {
  matchStatus: Exclude<WaMatchStatus, 'manually_linked'>;
  primaryLink: WaLinkCandidate | null;
  candidateLinks: WaLinkCandidate[];
};
