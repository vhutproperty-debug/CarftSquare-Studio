import { GA_EVENTS } from '@/lib/analytics/events';
import { GA_MEASUREMENT_ID } from '@/lib/analytics/ga-measurement-id';

export { GA_EVENTS };

let lastTrackedPagePath = '';

export function getGaMeasurementId() {
  return GA_MEASUREMENT_ID;
}

export function isGa4Enabled() {
  if (typeof window === 'undefined') return false;
  return Boolean(getGaMeasurementId()) && typeof window.gtag === 'function';
}

function buildPagePath(pathname, search) {
  const path = pathname || (typeof window !== 'undefined' ? window.location.pathname : '/');
  const query = search ?? (typeof window !== 'undefined' ? window.location.search : '');
  return `${path}${query || ''}`;
}

/** SPA page_view — deduped per path+query to avoid double fires. */
export function trackGaPageView(pathname, search = '') {
  if (!isGa4Enabled()) return;

  const pagePath = buildPagePath(pathname, search);
  if (pagePath === lastTrackedPagePath) return;
  lastTrackedPagePath = pagePath;

  window.gtag('event', 'page_view', {
    page_path: pagePath,
    page_title: typeof document !== 'undefined' ? document.title : undefined,
    page_location: typeof window !== 'undefined' ? window.location.href : undefined,
  });
}

export function trackGaEvent(eventName, parameters = {}) {
  if (!isGa4Enabled()) return;
  window.gtag('event', eventName, parameters);
}

export function isWhatsAppHref(href = '') {
  const value = String(href).toLowerCase();
  return value.includes('wa.me') || value.includes('whatsapp.com') || value.includes('api.whatsapp.com');
}

export function isPhoneHref(href = '') {
  return String(href).toLowerCase().startsWith('tel:');
}

export function isBlogCtaHref(pathname = '', href = '') {
  if (!String(pathname).startsWith('/blog')) return false;
  const value = String(href).toLowerCase();
  return value.includes('/estimate')
    || isWhatsAppHref(value)
    || value.includes('#contact');
}
