import { getMetaAccessToken, getMetaGraphEventsUrl, getMetaPixelIdServer, getMetaTestEventCode, validateMetaCapiConfig } from './config';
import { hashUserData } from './hash';
import type { MetaConversionEventInput, MetaCapiSendResult } from './types';

function summarizeHashedUserData(userData: ReturnType<typeof hashUserData>) {
  return {
    hasEmail: Boolean(userData.em?.length),
    hasPhone: Boolean(userData.ph?.length),
    hasFirstName: Boolean(userData.fn?.length),
    hasLastName: Boolean(userData.ln?.length),
    hasFbp: Boolean(userData.fbp),
    hasFbc: Boolean(userData.fbc),
    hasIp: Boolean(userData.client_ip_address),
    hasUserAgent: Boolean(userData.client_user_agent),
  };
}

export async function sendMetaConversionEvent(input: MetaConversionEventInput): Promise<MetaCapiSendResult> {
  const config = validateMetaCapiConfig();
  if (!config.enabled) {
    console.warn('[Meta CAPI] Skipped — missing configuration:', {
      missing: config.missing,
      eventName: input.eventName,
      eventId: input.eventId,
    });
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

  console.info('[Meta CAPI] Sending event:', {
    eventName: input.eventName,
    eventId: input.eventId,
    eventSourceUrl: input.eventSourceUrl,
    landingPage: input.customData?.landing_page,
    contentName: input.customData?.content_name,
    testMode: Boolean(testEventCode),
    advancedMatching: summarizeHashedUserData(userData),
  });

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
        fbtraceId: result?.error?.fbtrace_id,
      });
      return {
        ok: false,
        error: message,
      };
    }

    console.info('[Meta CAPI] Event accepted:', {
      eventName: input.eventName,
      eventId: input.eventId,
      eventsReceived: result?.events_received,
      fbtraceId: result?.fbtrace_id,
      testMode: Boolean(testEventCode),
    });

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
