'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const MetaPixelPageView = dynamic(() => import('@/components/MetaPixelPageView'), { ssr: false });
const MetaContactTracker = dynamic(() => import('@/components/MetaContactTracker'), { ssr: false });

export default function MetaPixelRoot() {
  return (
    <Suspense fallback={null}>
      <MetaPixelPageView />
      <MetaContactTracker />
    </Suspense>
  );
}
