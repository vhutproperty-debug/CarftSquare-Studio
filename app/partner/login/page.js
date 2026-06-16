'use client';

import { Suspense } from 'react';
import PartnerAuthFlow from '@/components/partner-network/PartnerAuthFlow';

export default function PartnerLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <Suspense fallback={<p className="text-slate-400">Loading...</p>}>
        <PartnerAuthFlow />
      </Suspense>
    </main>
  );
}
