'use client';

import { useEffect } from 'react';
import { isMetaPixelEnabled, trackContact } from '@/lib/meta-pixel';

function isWhatsAppLink(href: string): boolean {
  return href.includes('wa.me') || href.includes('whatsapp.com') || href.includes('api.whatsapp.com');
}

function isPhoneLink(href: string): boolean {
  return href.startsWith('tel:');
}

/**
 * Delegated click tracking for WhatsApp and phone links (Contact event).
 */
export default function MetaContactTracker() {
  useEffect(() => {
    if (!isMetaPixelEnabled()) return;

    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor?.href) return;

      const href = anchor.href;
      if (isWhatsAppLink(href)) {
        trackContact({
          content_name: 'whatsapp_click',
          link_url: href,
        });
        return;
      }

      if (isPhoneLink(href)) {
        trackContact({
          content_name: 'phone_click',
          link_url: href,
        });
      }
    }

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  return null;
}
