'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import {
  isMetaPixelEnabled,
  shouldTrackViewContent,
  trackPageView,
  trackViewContent,
  viewContentPayloadForPath,
} from '@/lib/meta-pixel';


/**
 * Fires PageView on route changes (layout script only runs fbq init — no duplicate PageView).
 * ViewContent only on meaningful project/service detail paths; CAPI shares event_id.
 */
export default function MetaPixelPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname || pathname.startsWith('/ops') || pathname.startsWith('/admin') || pathname.startsWith('/research')) {
      return;
    }
    if (!isMetaPixelEnabled()) return;

    trackPageView({ page_path: pathname });

    if (shouldTrackViewContent(pathname)) {
      trackViewContent(viewContentPayloadForPath(pathname));
    }
  }, [pathname, searchParams]);

  return null;
}
