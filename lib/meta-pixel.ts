/**
 * Meta Pixel (Facebook) tracking utilities.
 *
 * Enabled only when NODE_ENV === 'production' AND NEXT_PUBLIC_META_PIXEL_ID is set.
 * All functions fail gracefully in development or when the pixel is unavailable.
 *
 * Future event hooks — call these from the relevant UI after a successful action:
 *   trackContact()             → WhatsApp clicks, phone taps, email links
 *   trackCompleteRegistration()  → Account signup, newsletter, vendor onboarding
 *   trackLead({ content_name })  → Any new lead / quote / callback conversion
 */

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

/** True only in production with a configured pixel ID. */
export function isMetaPixelEnabled(): boolean {
  return process.env.NODE_ENV === 'production' && Boolean(getMetaPixelId());
}

/** Returns the pixel ID or null when disabled / missing. */
export function getMetaPixelId(): string | null {
  const id = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();
  return id || null;
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

/** Standard PageView — used on SPA route changes (initial load handled by layout script). */
export function trackPageView(): void {
  safeFbq('track', 'PageView');
}

/**
 * Lead conversion — AI estimate, consultation form, designer callback, etc.
 * Pass content_name to identify the source in Meta Events Manager.
 */
export function trackLead(params?: Record<string, unknown>): void {
  safeFbq('track', 'Lead', params ?? {});
}

/** Contact intent — e.g. WhatsApp button, click-to-call, contact page submission. */
export function trackContact(params?: Record<string, unknown>): void {
  safeFbq('track', 'Contact', params ?? {});
}

/** Registration complete — e.g. user account, vendor signup, newsletter (future). */
export function trackCompleteRegistration(params?: Record<string, unknown>): void {
  safeFbq('track', 'CompleteRegistration', params ?? {});
}

/** Convenience wrapper with a typed lead source label. */
export function trackLeadFromSource(source: MetaLeadSource, extra?: Record<string, unknown>): void {
  trackLead({ content_name: source, ...extra });
}
