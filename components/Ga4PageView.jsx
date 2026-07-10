'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { isGa4Enabled, trackGaPageView } from '@/lib/analytics/ga4';

/**
 * Fires GA4 page_view on App Router navigations.
 * Initial config uses send_page_view: false to prevent duplicate automatic hits.
 */
export default function Ga4PageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ? `?${searchParams.toString()}` : '';

  useEffect(() => {
    if (!pathname || pathname.startsWith('/ops')) return;
    if (!isGa4Enabled()) return;
    trackGaPageView(pathname, search);
  }, [pathname, search]);

  return null;
}
