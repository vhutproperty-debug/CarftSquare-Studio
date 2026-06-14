'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { getGaMeasurementId } from '@/lib/analytics/ga4';

const Ga4PageView = dynamic(() => import('@/components/Ga4PageView'), { ssr: false });
const Ga4ClickTracker = dynamic(() => import('@/components/Ga4ClickTracker'), { ssr: false });

export default function Ga4Root() {
  if (!getGaMeasurementId()) return null;

  return (
    <Suspense fallback={null}>
      <Ga4PageView />
      <Ga4ClickTracker />
    </Suspense>
  );
}
