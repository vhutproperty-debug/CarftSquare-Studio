'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  GA_EVENTS,
  isBlogCtaHref,
  isGa4Enabled,
  isPhoneHref,
  isWhatsAppHref,
  trackGaEvent,
} from '@/lib/analytics/ga4';

/** Delegated click tracking for WhatsApp, phone, and blog CTAs. */
export default function Ga4ClickTracker() {
  const pathname = usePathname() || '/';

  useEffect(() => {
    if (!isGa4Enabled()) return;

    function handleClick(event) {
      const anchor = event.target?.closest?.('a[href]');
      if (!anchor?.href) return;

      const href = anchor.href;
      const linkText = anchor.getAttribute('aria-label') || anchor.textContent?.trim()?.slice(0, 80) || '';

      if (isWhatsAppHref(href)) {
        trackGaEvent(GA_EVENTS.WHATSAPP_CLICK, {
          link_url: href,
          link_text: linkText,
          page_path: pathname,
        });
        return;
      }

      if (isPhoneHref(href)) {
        trackGaEvent(GA_EVENTS.PHONE_CALL_CLICK, {
          link_url: href,
          link_text: linkText,
          page_path: pathname,
        });
        return;
      }

      if (isBlogCtaHref(pathname, href)) {
        trackGaEvent(GA_EVENTS.BLOG_CTA_CLICK, {
          link_url: href,
          link_text: linkText,
          page_path: pathname,
          blog_slug: pathname.startsWith('/blog/') ? pathname.split('/').pop() : undefined,
        });
      }
    }

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [pathname]);

  return null;
}
