import { getMetaAccessToken, getMetaGraphEventsUrl, getMetaPixelIdServer, getMetaTestEventCode, isMetaCapiEnabled } from './config';
import { hashUserData } from './hash';
import type { MetaConversionEventInput, MetaCapiSendResult } from './types';

export async function sendMetaConversionEvent(input: MetaConversionEventInput): Promise<MetaCapiSendResult> {
  if (!isMetaCapiEnabled()) {
    return { ok: false, skipped: true, error: 'Meta CAPI is not configured.' };
  }

  const pixelId = getMetaPixelIdServer();
  const accessToken = getMetaAccessToken();
  if (!pixelId || !accessToken) {
    return { ok: false, skipped: true, error: 'Missing Meta pixel ID or access token.' };
  }

  const userData = hashUserData(input.userData, {
    clientIpAddress: input.clientIpAddress,
    clientUserAgent: input.clientUserAgent,
  });

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: input.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: 'website',
        event_source_url: input.eventSourceUrl,
        user_data: userData,
        custom_data: input.customData || {},
      },
    ],
  };

  const testEventCode = getMetaTestEventCode();
  if (testEventCode) {
    payload.test_event_code = testEventCode;
  }

  try {
    const response = await fetch(getMetaGraphEventsUrl(pixelId, accessToken), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        typeof result?.error?.message === 'string' ? result.error.message : 'Meta CAPI request failed.';
      console.error('[Meta CAPI] Graph API error:', {
        eventName: input.eventName,
        eventId: input.eventId,
        status: response.status,
        message,
      });
      return {
        ok: false,
        error: message,
      };
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Meta CAPI request failed.';
    console.error('[Meta CAPI] Request failed:', {
      eventName: input.eventName,
      eventId: input.eventId,
      message,
    });
    return {
      ok: false,
      error: message,
    };
  }
}
