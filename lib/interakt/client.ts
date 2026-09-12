/**
 * Minimal Interakt public API client.
 *
 * Confirmed (official Interakt docs):
 * - POST https://api.interakt.ai/v1/public/message/
 * - Authorization: Basic <INTERAKT_API_KEY>
 * - Content-Type: application/json
 * - type: "Template" for template/HSM sends
 *
 * Session text / free-form media send endpoints are NOT implemented here
 * until confirmed in current Interakt documentation (avoid inventing APIs).
 */

const INTERAKT_MESSAGE_URL = 'https://api.interakt.ai/v1/public/message/';

export type InteraktSendTemplateInput = {
  countryCode: string;
  phoneNumber: string;
  template: {
    name: string;
    languageCode: string;
    headerValues?: string[];
    bodyValues?: string[];
    buttonValues?: Record<string, string[]>;
    fileName?: string;
  };
  callbackData?: string;
  campaignId?: string;
};

export type InteraktSendTemplateResult = {
  result: boolean;
  message?: string;
  id?: string;
  raw: unknown;
};

function getApiKey(): string {
  const key = process.env.INTERAKT_API_KEY?.trim();
  if (!key) {
    throw new Error('INTERAKT_API_KEY is not configured.');
  }
  return key;
}

export async function sendInteraktTemplate(
  input: InteraktSendTemplateInput,
): Promise<InteraktSendTemplateResult> {
  const apiKey = getApiKey();
  const body: Record<string, unknown> = {
    countryCode: input.countryCode,
    phoneNumber: input.phoneNumber,
    type: 'Template',
    template: input.template,
  };
  if (input.callbackData) body.callbackData = input.callbackData;
  if (input.campaignId) body.campaignId = input.campaignId;

  const response = await fetch(INTERAKT_MESSAGE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const raw = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(
      `Interakt template send failed with HTTP ${response.status}`,
    ) as Error & { status?: number; details?: unknown };
    err.status = response.status;
    err.details = raw;
    throw err;
  }

  return {
    result: Boolean((raw as { result?: boolean }).result),
    message: (raw as { message?: string }).message,
    id: (raw as { id?: string }).id,
    raw,
  };
}

/**
 * TODO (requires Interakt doc verification — do not invent):
 * - sendText / session messages
 * - sendMedia free-form
 * - contact Track create/update
 * - message status retrieve (webhooks preferred)
 */
export const interaktClientTodos = [
  'sendText (session) — verify endpoint against current Interakt docs before implementing',
  'sendMedia (non-template) — verify endpoint against current Interakt docs before implementing',
  'Track/contact APIs — verify if needed for Phase 2+',
] as const;
