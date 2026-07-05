import { trackGaEvent, trackGaPageView } from '@/lib/analytics/ga4';
import { isMetaPixelEnabled, trackLeadFromSource } from '@/lib/meta-pixel';
import { AURIS_LANDING_PATH } from './constants';

type AurisEventParams = {
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

function trackAurisEvent(eventName: string, params: AurisEventParams = {}): void {
  trackGaEvent(eventName, {
    page_path: AURIS_LANDING_PATH,
    campaign: 'auris_serenity',
    ...params,
  });
  invokeMetaCustom(eventName, {
    page_path: AURIS_LANDING_PATH,
    ...params,
  });
}

export function trackAurisPageView(): void {
  trackGaPageView(AURIS_LANDING_PATH);
  trackAurisEvent('AurisPageView');
}

export function trackAurisIntentSelected(selectedIntent: string): void {
  trackAurisEvent('AurisIntentSelected', { selected_intent: selectedIntent });
}

export function trackAurisLeadSubmitted(selectedIntent: string, possessionTimeline: string): void {
  trackAurisEvent('AurisLeadSubmitted', {
    selected_intent: selectedIntent,
    possession_timeline: possessionTimeline,
  });
}

export function trackAurisWhatsAppClicked(selectedIntent: string, clickLocation = 'lead_bot'): void {
  trackAurisEvent('AurisWhatsAppClicked', {
    selected_intent: selectedIntent,
    click_location: clickLocation,
  });
}

export function trackAurisMetaLead(selectedIntent: string, possessionTimeline: string): void {
  trackLeadFromSource('ai_interior_consultant', {
    form_source: 'auris_serenity',
    landing_page: AURIS_LANDING_PATH,
    selected_intent: selectedIntent,
    possession_timeline: possessionTimeline,
  });
}
