'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { isMetaPixelEnabled, shouldTrackViewContent, trackPageView, trackViewContent } from '@/lib/meta-pixel';

/**
 * Fires PageView (+ ViewContent on key pages) with shared event_id for Pixel + CAPI.
 * Initial PageView is handled here (layout script only runs fbq init).
 */
export default function MetaPixelPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isMetaPixelEnabled()) return;

    trackPageView({ page_path: pathname });

    if (shouldTrackViewContent(pathname)) {
      trackViewContent({
        content_name: pathname,
        page_path: pathname,
      });
    }
  }, [pathname, searchParams]);

  return null;
}
