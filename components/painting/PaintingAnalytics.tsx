'use client';

import { useEffect, useRef } from 'react';
import { PAINTING_LANDING_PATH } from '@/lib/painting/constants';
import { trackGaEvent, trackGaPageView } from '@/lib/analytics/ga4';

const SCROLL_MILESTONES = [25, 50, 75, 100] as const;

export default function PaintingAnalytics() {
  const firedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    trackGaPageView(PAINTING_LANDING_PATH);
  }, []);

  useEffect(() => {
    function onScroll() {
      const doc = document.documentElement;
      const scrollTop = doc.scrollTop || document.body.scrollTop;
      const scrollHeight = doc.scrollHeight - doc.clientHeight;
      if (scrollHeight <= 0) return;

      const percent = Math.min(100, Math.round((scrollTop / scrollHeight) * 100));
      for (const milestone of SCROLL_MILESTONES) {
        if (percent >= milestone && !firedRef.current.has(milestone)) {
          firedRef.current.add(milestone);
          trackGaEvent('painting_scroll_depth', {
            page_path: PAINTING_LANDING_PATH,
            scroll_percent: milestone,
          });
        }
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return null;
}

export function trackPaintingWhatsAppClick(location: string) {
  trackGaEvent('whatsapp_click', {
    page_path: PAINTING_LANDING_PATH,
    click_location: location,
    service: 'painting',
  });
}

export function trackPaintingCallClick(location: string) {
  trackGaEvent('phone_call_click', {
    page_path: PAINTING_LANDING_PATH,
    click_location: location,
    service: 'painting',
  });
}

export function trackPaintingFormSubmit() {
  trackGaEvent('contact_form_submitted', {
    page_path: PAINTING_LANDING_PATH,
    form_location: 'painting_lead_form',
    service: 'painting',
  });
}
