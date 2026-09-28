/**
 * Meta Pixel (browser) + Conversions API (server) tracking utilities.
 *
 * Browser Pixel fires in production. Matching CAPI events are sent server-side
 * with the same event_id for Meta deduplication (except PageView — browser only).
 *
 * Server secrets (META_ACCESS_TOKEN) never leave /api/meta/capi.
 */

import type { MetaCapiEventName, MetaCapiProxyEventName, MetaRawUserData } from '@/lib/meta-capi/types';
import { META_CAPI_PROXY_EVENTS } from '@/lib/meta-capi/types';
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
  | 'partner_callback'
  | 'painting_landing';

const CAPI_EVENTS = new Set<string>(META_CAPI_PROXY_EVENTS);

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

/** Prefer _fbc cookie; if missing but fbclid is in URL, build Meta-compatible fbc. */
function resolveFbc(): string | undefined {
  const cookie = readCookie('_fbc');
  if (cookie) return cookie;
  if (typeof window === 'undefined') return undefined;
  try {
    const fbclid = new URLSearchParams(window.location.search).get('fbclid');
    if (!fbclid) return undefined;
    return `fb.1.${Date.now()}.${fbclid}`;
  } catch {
    return undefined;
  }
}

function getMetaCookies(): Pick<MetaRawUserData, 'fbp' | 'fbc'> {
  return {
    fbp: readCookie('_fbp'),
    fbc: resolveFbc(),
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
  eventName: MetaCapiProxyEventName,
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

  if (CAPI_EVENTS.has(eventName)) {
    sendMetaCapiEvent(eventName as MetaCapiProxyEventName, eventId, customData, userData);
  }

  return eventId;
}

export function trackPageView(customData?: Record<string, unknown>): string {
  return trackMetaEvent('PageView', customData);
}

export function trackViewContent(customData?: Record<string, unknown>): string {
  return trackMetaEvent('ViewContent', customData);
}

export function trackSearch(
  searchString: string,
  extra?: Record<string, unknown>,
): string {
  const trimmed = searchString.trim();
  if (!trimmed) return '';
  return trackMetaEvent('Search', {
    search_string: trimmed.slice(0, 200),
    ...extra,
  });
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
      content_category: 'lead',
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

/**
 * Meaningful project/service detail views only — not every page.
 */
export function shouldTrackViewContent(pathname: string): boolean {
  if (!pathname || pathname === '/') return false;
  if (pathname.startsWith('/ops') || pathname.startsWith('/admin') || pathname.startsWith('/research')) {
    return false;
  }

  return (
    pathname === '/estimate' ||
    pathname.startsWith('/estimate/') ||
    pathname.startsWith('/services/') ||
    pathname === '/rental-interiors' ||
    pathname === '/painting' ||
    pathname === '/free-interior-consultation' ||
    pathname === '/oberoi-elysian-rental-interiors' ||
    pathname === '/auris-serenity' ||
    pathname === '/satellite-elegance' ||
    pathname === '/gallery' ||
    pathname.startsWith('/blog/')
  );
}

export function viewContentPayloadForPath(pathname: string): Record<string, unknown> {
  const contentId = pathname.replace(/^\//, '') || 'home';
  let contentCategory = 'page';
  if (pathname.startsWith('/services/')) contentCategory = 'service';
  else if (pathname.startsWith('/estimate')) contentCategory = 'estimate';
  else if (
    pathname.includes('elysian') ||
    pathname.includes('auris') ||
    pathname.includes('satellite') ||
    pathname === '/free-interior-consultation'
  ) {
    contentCategory = 'project';
  } else if (pathname.startsWith('/blog/')) contentCategory = 'blog';
  else if (pathname === '/painting') contentCategory = 'painting';

  return {
    content_name: pathname,
    content_ids: [contentId],
    content_type: 'product',
    content_category: contentCategory,
    page_path: pathname,
  };
}
