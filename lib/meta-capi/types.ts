export type MetaCapiEventName = 'PageView' | 'ViewContent' | 'Lead' | 'Contact' | 'Schedule';

export interface MetaRawUserData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  fbp?: string;
  fbc?: string;
}

export interface MetaHashedUserData {
  em?: string[];
  ph?: string[];
  fn?: string[];
  ln?: string[];
  fbp?: string;
  fbc?: string;
  client_ip_address?: string;
  client_user_agent?: string;
}

export interface MetaConversionEventInput {
  eventName: MetaCapiEventName;
  eventId: string;
  eventSourceUrl: string;
  userData?: MetaRawUserData;
  customData?: Record<string, unknown>;
  clientIpAddress?: string;
  clientUserAgent?: string;
}

export interface MetaCapiSendResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}
