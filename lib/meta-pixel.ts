/**
 * Meta Pixel (browser) + Conversions API (server) tracking utilities.
 *
 * Browser Pixel fires in production. Matching CAPI events are sent server-side
 * with the same event_id for Meta deduplication.
 *
 * Server secrets (META_ACCESS_TOKEN) never leave /api/meta/capi.
 */

import type { MetaCapiEventName, MetaRawUserData } from '@/lib/meta-capi/types';
import { META_PIXEL_ID } from '@/lib/meta-pixel-id';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

export type MetaLeadSource =
  | 'ai_interior_consultant'
  | 'contact_consultation_form'
  | 'designer_callback'
  | 'partner_callback';

export function isMetaPixelEnabled(): boolean {
  return process.env.NODE_ENV === 'production' && Boolean(getMetaPixelId());
}

export function getMetaPixelId(): string | null {
  if (process.env.NODE_ENV !== 'production') return null;
  return process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || META_PIXEL_ID;
}

export function generateMetaEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

function getMetaCookies(): Pick<MetaRawUserData, 'fbp' | 'fbc'> {
  return {
    fbp: readCookie('_fbp'),
    fbc: readCookie('_fbc'),
  };
}

function invokeFbq(...args: unknown[]): void {
  if (typeof window.fbq !== 'function') return;
  try {
    window.fbq(...args);
  } catch {
    // Never block app flow if Meta Pixel errors
  }
}

function safeFbq(...args: unknown[]): void {
  if (typeof window === 'undefined') return;
  if (!isMetaPixelEnabled()) return;

  if (typeof window.fbq === 'function') {
    invokeFbq(...args);
    return;
  }

  // Layout pixel script loads afterInteractive — retry so first PageView is not missed.
  const delays = [300, 800, 1500];
  for (const delay of delays) {
    window.setTimeout(() => invokeFbq(...args), delay);
  }
}

function sendMetaCapiEvent(
  eventName: MetaCapiEventName,
  eventId: string,
  customData?: Record<string, unknown>,
  userData?: MetaRawUserData,
): void {
  if (typeof window === 'undefined' || !isMetaPixelEnabled()) return;

  const payload = {
    eventName,
    eventId,
    eventSourceUrl: window.location.href,
    customData: customData || {},
    userData: {
      ...getMetaCookies(),
      ...userData,
    },
  };

  fetch('/api/meta/capi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Fire-and-forget — never block UX
  });
}

function trackMetaEvent(
  eventName: MetaCapiEventName,
  customData?: Record<string, unknown>,
  userData?: MetaRawUserData,
): string {
  const eventId = generateMetaEventId();

  safeFbq('track', eventName, customData ?? {}, { eventID: eventId });
  if (eventName === 'Lead') {
    sendMetaCapiEvent(eventName, eventId, customData, userData);
  }

  return eventId;
}

export function trackPageView(customData?: Record<string, unknown>): string {
  return trackMetaEvent('PageView', customData);
}

export function trackViewContent(customData?: Record<string, unknown>): string {
  return trackMetaEvent('ViewContent', customData);
}

export function trackLead(
  params?: Record<string, unknown>,
  userData?: MetaRawUserData,
): string {
  return trackMetaEvent('Lead', params ?? {}, userData);
}

export function trackContact(
  params?: Record<string, unknown>,
  userData?: MetaRawUserData,
): string {
  return trackMetaEvent('Contact', params ?? {}, userData);
}

export function trackSchedule(
  params?: Record<string, unknown>,
  userData?: MetaRawUserData,
): string {
  return trackMetaEvent('Schedule', params ?? {}, userData);
}

export function trackCompleteRegistration(params?: Record<string, unknown>): string {
  return trackMetaEvent('Lead', { ...params, registration: true });
}

export function trackLeadFromSource(
  source: MetaLeadSource,
  extra?: Record<string, unknown>,
  userData?: MetaRawUserData,
): string {
  const landingPage =
    (typeof extra?.landing_page === 'string' && extra.landing_page) ||
    (typeof window !== 'undefined' ? window.location.pathname : undefined);

  return trackLead(
    {
      content_name: source,
      ...extra,
      ...(landingPage ? { landing_page: landingPage } : {}),
    },
    userData,
  );
}

export function splitFullName(fullName: string): { firstName?: string; lastName?: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return {};
  if (parts.length === 1) return { firstName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export function shouldTrackViewContent(pathname: string): boolean {
  return (
    pathname === '/estimate' ||
    pathname.startsWith('/estimate/') ||
    pathname.startsWith('/services/') ||
    pathname === '/rental-interiors'
  );
}
