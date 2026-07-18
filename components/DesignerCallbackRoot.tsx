'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

const DesignerCallbackWidget = dynamic(() => import('@/components/DesignerCallbackWidget'), {
  ssr: false,
});

/** Hide the marketing designer CTA on Prop/Research routes. */
export default function DesignerCallbackRoot() {
  const pathname = usePathname() || '';
  if (pathname.startsWith('/research')) {
    return null;
  }
  return <DesignerCallbackWidget />;
}
