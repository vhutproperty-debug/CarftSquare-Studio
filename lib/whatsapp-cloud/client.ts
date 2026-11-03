import { graphUrl } from '@/lib/meta/config';
import { classifyWhatsAppError } from '@/lib/whatsapp-cloud/errors';
import {
  getWhatsAppAccessToken,
  getWhatsAppDefaultLanguage,
  getWhatsAppPhoneNumberId,
  getWhatsAppWabaId,
} from '@/lib/whatsapp-cloud/config';
import { toWhatsAppRecipient } from '@/lib/whatsapp-cloud/phone';
import { getWhatsAppSendDecision } from '@/lib/whatsapp-cloud/send-policy';

const MAX_ATTEMPTS = 3;

export class WhatsAppApiError extends Error {
  code: number | null;
  subcode: number | null;
  fbtraceId: string | null;
  retryable: boolean;
  httpStatus: number | null;
  kind: string;

  constructor(
    message: string,
    opts: {
      code?: number | null;
      subcode?: number | null;
      fbtraceId?: string | null;
      retryable?: boolean;
      httpStatus?: number | null;
      kind?: string;
    } = {},
  ) {
    super(message);
    this.name = 'WhatsAppApiError';
    this.code = opts.code ?? null;
    this.subcode = opts.subcode ?? null;
    this.fbtraceId = opts.fbtraceId ?? null;
    this.retryable = Boolean(opts.retryable);
    this.httpStatus = opts.httpStatus ?? null;
    this.kind = opts.kind || 'unknown';
  }
}

type GraphErrorBody = {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

export async function graph<T = Record<string, unknown>>(
  path: string,
  init?: {
    method?: string;
    body?: unknown;
    formData?: FormData;
    token?: string;
  },
): Promise<T> {
  const token = init?.token || getWhatsAppAccessToken();
  if (!token) {
    throw new WhatsAppApiError('WhatsApp access token is not configured.', {
      httpStatus: 503,
      retryable: false,
    });
  }

  const method = init?.method || (init?.body || init?.formData ? 'POST' : 'GET');
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  let body: BodyInit | undefined;
  if (init?.formData) {
    body = init.formData;
  } else if (init?.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.body);
  }

  const response = await fetch(graphUrl(path, token), { method, headers, body });
  const json = (await response.json().catch(() => ({}))) as GraphErrorBody & T;
  if (!response.ok || json.error) {
    const classified = classifyWhatsAppError(json.error?.code, response.status);
    throw new WhatsAppApiError(json.error?.message || `WhatsApp Graph HTTP ${response.status}`, {
      code: json.error?.code ?? null,
      subcode: json.error?.error_subcode ?? null,
      fbtraceId: json.error?.fbtrace_id ?? null,
      retryable: classified.retryable,
      httpStatus: response.status,
      kind: classified.kind,
    });
  }
  return json;
}

async function assertCanSend(): Promise<void> {
  const decision = await getWhatsAppSendDecision();
  if (decision.blocked) {
    throw new WhatsAppApiError(decision.reason || 'WhatsApp sending is blocked because the WABA is restricted.', {
      code: 131031,
      retryable: false,
      kind: 'account_restricted',
    });
  }
}

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      const err = error instanceof WhatsAppApiError
        ? error
        : new WhatsAppApiError(error instanceof Error ? error.message : String(error), {
          retryable: true,
        });
      lastError = err;
      if (!err.retryable || attempt === MAX_ATTEMPTS) throw err;
      await new Promise((resolve) => setTimeout(resolve, attempt * 400));
      console.warn('[whatsapp] retry', JSON.stringify({ label, attempt, code: err.code }));
    }
  }
  throw lastError || new Error('WhatsApp request failed.');
}

export type TemplateComponent = {
  type: 'header' | 'body' | 'button';
  sub_type?: string;
  index?: string;
  parameters: Array<{ type: 'text'; text: string }>;
};

export async function sendText(
  to: string,
  bodyText: string,
  opts: { previewUrl?: boolean; replyTo?: string; ignoreOptOut?: boolean } = {},
) {
  await assertCanSend();
  const phoneId = getWhatsAppPhoneNumberId();
  if (!phoneId) throw new WhatsAppApiError('WHATSAPP_PHONE_NUMBER_ID is not configured.', { httpStatus: 503 });
  const recipient = toWhatsAppRecipient(to);
  const payload: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'text',
    text: { preview_url: Boolean(opts.previewUrl), body: bodyText },
  };
  if (opts.replyTo) payload.context = { message_id: opts.replyTo };
  return withRetry('sendText', () => graph<{ messages?: Array<{ id: string }> }>(
    `/${phoneId}/messages`,
    { method: 'POST', body: payload },
  ));
}

export async function sendTemplate(
  to: string,
  name: string,
  lang: string | undefined,
  components?: TemplateComponent[],
) {
  await assertCanSend();
  const phoneId = getWhatsAppPhoneNumberId();
  if (!phoneId) throw new WhatsAppApiError('WHATSAPP_PHONE_NUMBER_ID is not configured.', { httpStatus: 503 });
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: toWhatsAppRecipient(to),
    type: 'template',
    template: {
      name,
      language: { code: lang || getWhatsAppDefaultLanguage() },
      ...(components?.length ? { components } : {}),
    },
  };
  return withRetry('sendTemplate', () => graph<{ messages?: Array<{ id: string }> }>(
    `/${phoneId}/messages`,
    { method: 'POST', body: payload },
  ));
}

export async function sendMedia(
  to: string,
  type: 'image' | 'document' | 'video' | 'audio',
  media: { id?: string; link?: string; caption?: string; filename?: string },
) {
  await assertCanSend();
  const phoneId = getWhatsAppPhoneNumberId();
  if (!phoneId) throw new WhatsAppApiError('WHATSAPP_PHONE_NUMBER_ID is not configured.', { httpStatus: 503 });
  if (!media.id && !media.link) {
    throw new WhatsAppApiError('Media send requires an id or link.', { httpStatus: 400 });
  }
  const mediaBody: Record<string, string> = {};
  if (media.id) mediaBody.id = media.id;
  if (media.link) mediaBody.link = media.link;
  if (media.caption && type !== 'audio') mediaBody.caption = media.caption;
  if (media.filename && type === 'document') mediaBody.filename = media.filename;
  return withRetry('sendMedia', () => graph<{ messages?: Array<{ id: string }> }>(
    `/${phoneId}/messages`,
    {
      method: 'POST',
      body: {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: toWhatsAppRecipient(to),
        type,
        [type]: mediaBody,
      },
    },
  ));
}

export async function uploadMedia(buffer: Buffer, mime: string, filename = 'upload') {
  const phoneId = getWhatsAppPhoneNumberId();
  if (!phoneId) throw new WhatsAppApiError('WHATSAPP_PHONE_NUMBER_ID is not configured.', { httpStatus: 503 });
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', mime);
  form.append('file', new Blob([new Uint8Array(buffer)], { type: mime }), filename);
  return graph<{ id: string }>(`/${phoneId}/media`, { method: 'POST', formData: form });
}

export async function markRead(messageId: string) {
  const phoneId = getWhatsAppPhoneNumberId();
  if (!phoneId) throw new WhatsAppApiError('WHATSAPP_PHONE_NUMBER_ID is not configured.', { httpStatus: 503 });
  return graph(`/${phoneId}/messages`, {
    method: 'POST',
    body: {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    },
  });
}

export type CloudTemplate = {
  name: string;
  language: string;
  status: string;
  category?: string;
  components?: unknown[];
  id?: string;
};

export async function listTemplates(): Promise<CloudTemplate[]> {
  const waba = getWhatsAppWabaId();
  if (!waba) throw new WhatsAppApiError('WHATSAPP_WABA_ID is not configured.', { httpStatus: 503 });
  const rows: CloudTemplate[] = [];
  let path = `/${waba}/message_templates?limit=100&fields=name,language,status,category,components,id`;
  for (let page = 0; page < 10; page += 1) {
    const data = await graph<{ data?: Array<Record<string, unknown>>; paging?: { next?: string } }>(path);
    for (const row of data.data || []) {
      rows.push({
        name: String(row.name || ''),
        language: String(row.language || ''),
        status: String(row.status || ''),
        category: row.category ? String(row.category) : undefined,
        components: Array.isArray(row.components) ? row.components : undefined,
        id: row.id ? String(row.id) : undefined,
      });
    }
    const next = data.paging?.next;
    if (!next) break;
    const url = new URL(next);
    path = `${url.pathname.replace(/^\/v\d+\.\d+/, '')}${url.search}`;
  }
  return rows.filter((row) => row.name);
}

export async function getPhoneNumberStatus() {
  const phoneId = getWhatsAppPhoneNumberId();
  if (!phoneId) throw new WhatsAppApiError('WHATSAPP_PHONE_NUMBER_ID is not configured.', { httpStatus: 503 });
  return graph<{
    display_phone_number?: string;
    verified_name?: string;
    quality_rating?: string;
    code_verification_status?: string;
    platform_type?: string;
    throughput?: { level?: string };
    name_status?: string;
  }>(
    `/${phoneId}?fields=display_phone_number,verified_name,quality_rating,code_verification_status,platform_type,throughput,name_status`,
  );
}

export function messageIdFromSend(result: { messages?: Array<{ id: string }> }): string | undefined {
  return result.messages?.[0]?.id;
}

export type WaSendTemplateInput = {
  countryCode?: string;
  phoneNumber: string;
  template: {
    name: string;
    languageCode?: string;
    bodyValues?: string[];
    headerValues?: string[];
  };
  callbackData?: string;
  campaignId?: string;
};

/** Adapter used by follow-ups and campaign delivery. */
export async function sendWaTemplate(input: WaSendTemplateInput): Promise<{
  result: boolean;
  id?: string;
  message?: string;
  raw: unknown;
}> {
  const components = [];
  if (input.template.headerValues?.length) {
    components.push({
      type: 'header' as const,
      parameters: input.template.headerValues.map((text) => ({ type: 'text' as const, text })),
    });
  }
  if (input.template.bodyValues?.length) {
    components.push({
      type: 'body' as const,
      parameters: input.template.bodyValues.map((text) => ({ type: 'text' as const, text })),
    });
  }
  const raw = await sendTemplate(
    input.phoneNumber,
    input.template.name,
    input.template.languageCode,
    components,
  );
  const id = messageIdFromSend(raw);
  return { result: Boolean(id), id, raw };
}
