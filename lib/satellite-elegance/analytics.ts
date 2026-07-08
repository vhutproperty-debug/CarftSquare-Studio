import { trackGaEvent, trackGaPageView } from '@/lib/analytics/ga4';
import { isMetaPixelEnabled, trackLeadFromSource } from '@/lib/meta-pixel';
import { SATELLITE_LANDING_PATH } from './constants';

type SatelliteEventParams = {
  selected_intent?: string;
  possession_timeline?: string;
  click_location?: string;
};

function invokeMetaCustom(eventName: string, params: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined' || !isMetaPixelEnabled()) return;
  if (typeof window.fbq !== 'function') return;
  try {
    window.fbq('trackCustom', eventName, params);
  } catch {
    // Never block UX
  }
}

function trackSatelliteEvent(eventName: string, params: SatelliteEventParams = {}): void {
  trackGaEvent(eventName, {
    page_path: SATELLITE_LANDING_PATH,
    campaign: 'satellite_elegance',
    ...params,
  });
  invokeMetaCustom(eventName, {
    page_path: SATELLITE_LANDING_PATH,
    ...params,
  });
}

export function trackSatellitePageView(): void {
  trackGaPageView(SATELLITE_LANDING_PATH);
  trackSatelliteEvent('SatellitePageView');
}

export function trackSatelliteIntentSelected(selectedIntent: string): void {
  trackSatelliteEvent('SatelliteIntentSelected', { selected_intent: selectedIntent });
}

export function trackSatelliteLeadSubmitted(selectedIntent: string, possessionTimeline: string): void {
  trackSatelliteEvent('SatelliteLeadSubmitted', {
    selected_intent: selectedIntent,
    possession_timeline: possessionTimeline,
  });
}

export function trackSatelliteWhatsAppClicked(selectedIntent: string, clickLocation = 'lead_bot'): void {
  trackSatelliteEvent('SatelliteWhatsAppClicked', {
    selected_intent: selectedIntent,
    click_location: clickLocation,
  });
}

export function trackSatelliteMetaLead(selectedIntent: string, possessionTimeline: string): void {
  trackLeadFromSource('ai_interior_consultant', {
    form_source: 'satellite_elegance',
    landing_page: SATELLITE_LANDING_PATH,
    selected_intent: selectedIntent,
    possession_timeline: possessionTimeline,
  });
}
