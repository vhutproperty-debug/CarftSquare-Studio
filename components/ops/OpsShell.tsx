'use client';

import type { ReactNode } from 'react';
import OpsHeader from '@/components/ops/OpsHeader';
import OpsMobileNav from '@/components/ops/OpsMobileNav';
import OpsSidebar from '@/components/ops/OpsSidebar';

type OpsShellProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
};

export default function OpsShell({ children, title, subtitle }: OpsShellProps) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <OpsSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <OpsHeader title={title} subtitle={subtitle} />
          <main className="flex-1 px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-6">
            {children}
          </main>
          <OpsMobileNav />
        </div>
      </div>
    </div>
  );
}
