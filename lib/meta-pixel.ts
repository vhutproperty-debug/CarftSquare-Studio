/**
 * Meta Pixel (browser) + Conversions API (server) tracking utilities.
 *
 * Browser Pixel fires in production. Matching CAPI events are sent server-side
 * with the same event_id for Meta deduplication.
 *
 * Server secrets (META_ACCESS_TOKEN) never leave /api/meta/capi.
 */

import type { MetaCapiEventName, MetaRawUserData } from '@/lib/meta-capi/types';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

export type MetaLeadSource =
  | 'ai_interior_consultant'
  | 'contact_consultation_form'
  | 'designer_callback';

const DEFAULT_META_PIXEL_ID = '1340743388120075';

export function isMetaPixelEnabled(): boolean {
  return process.env.NODE_ENV === 'production' && Boolean(getMetaPixelId());
}

export function getMetaPixelId(): string | null {
  if (process.env.NODE_ENV !== 'production') return null;
  return process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || DEFAULT_META_PIXEL_ID;
}

export function generateMetaEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
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

function safeFbq(...args: unknown[]): void {
  if (typeof window === 'undefined') return;
  if (!isMetaPixelEnabled()) return;
  if (typeof window.fbq !== 'function') return;
  try {
    window.fbq(...args);
  } catch {
    // Never block app flow if Meta Pixel errors
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
  sendMetaCapiEvent(eventName, eventId, customData, userData);

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
  return trackLead({ content_name: source, ...extra }, userData);
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
