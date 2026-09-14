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
const MAX_ATTEMPTS = 3;

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

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
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

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
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
        ) as Error & { status?: number; details?: unknown; retryable?: boolean };
        err.status = response.status;
        err.details = raw;
        err.retryable = isRetryableStatus(response.status);
        if (err.retryable && attempt < MAX_ATTEMPTS) {
          lastError = err;
          console.warn(
            '[interakt] template_send_retry',
            JSON.stringify({ attempt, status: response.status }),
          );
          await sleep(attempt * 750);
          continue;
        }
        throw err;
      }

      const result = {
        result: Boolean((raw as { result?: boolean }).result),
        message: (raw as { message?: string }).message,
        id: (raw as { id?: string }).id,
        raw,
      };

      console.info(
        '[interakt] template_send_ok',
        JSON.stringify({
          attempt,
          id: result.id || null,
          template: input.template.name,
        }),
      );
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const retryable = (err as { retryable?: boolean }).retryable !== false
        && !(err as { status?: number }).status;
      if (retryable && attempt < MAX_ATTEMPTS && !(err as { status?: number }).status) {
        lastError = err;
        console.warn(
          '[interakt] template_send_network_retry',
          JSON.stringify({ attempt, error: err.message }),
        );
        await sleep(attempt * 750);
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('Interakt template send failed after retries.');
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
