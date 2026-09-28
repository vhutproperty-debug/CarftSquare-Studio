/** Standard events selected for CraftSquare Meta Property setup. PageView is browser-only. */
export type MetaCapiEventName =
  | 'PageView'
  | 'ViewContent'
  | 'Search'
  | 'Contact'
  | 'Lead'
  | 'Schedule';

/** Events allowed through the public /api/meta/capi proxy (never PageView). */
export const META_CAPI_PROXY_EVENTS = [
  'ViewContent',
  'Search',
  'Contact',
  'Lead',
  'Schedule',
] as const;

export type MetaCapiProxyEventName = (typeof META_CAPI_PROXY_EVENTS)[number];

export interface MetaRawUserData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  zip?: string;
  /** CRM lead/prospect id — hashed as external_id */
  externalId?: string;
  fbp?: string;
  fbc?: string;
}

export interface MetaHashedUserData {
  em?: string[];
  ph?: string[];
  fn?: string[];
  ln?: string[];
  ct?: string[];
  st?: string[];
  zp?: string[];
  external_id?: string[];
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
  /** Unix seconds — defaults to now when omitted */
  eventTime?: number;
}

export interface MetaCapiSendResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}
