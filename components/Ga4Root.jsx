'use client';

import dynamic from 'next/dynamic';
import { getGaMeasurementId } from '@/lib/analytics/ga4';

const Ga4ClickTracker = dynamic(() => import('@/components/Ga4ClickTracker'), { ssr: false });

/** Custom GA4 events (WhatsApp, blog CTA, etc.). Page views handled by @next/third-parties GoogleAnalytics. */
export default function Ga4Root() {
  if (!getGaMeasurementId()) return null;
  return <Ga4ClickTracker />;
}
