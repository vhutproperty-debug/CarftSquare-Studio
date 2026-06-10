'use client';

import dynamic from 'next/dynamic';

const DesignerCallbackWidget = dynamic(() => import('@/components/DesignerCallbackWidget'), { ssr: false });

export default function DesignerCallbackRoot() {
  return <DesignerCallbackWidget />;
}
