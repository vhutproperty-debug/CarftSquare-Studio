'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { isMetaPixelEnabled, trackPageView } from '@/lib/meta-pixel';

/**
 * Fires PageView on client-side route changes only.
 * The initial PageView is sent by the inline pixel script in app/layout.js
 * to avoid duplicate events on first load.
 */
export default function MetaPixelPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (!isMetaPixelEnabled()) return;

    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    trackPageView();
  }, [pathname, searchParams]);

  return null;
}
