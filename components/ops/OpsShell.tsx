'use client';

import type { ReactNode } from 'react';
import type { PipelineStageId } from '@/lib/ops/business';
import OpsHeader from '@/components/ops/OpsHeader';
import OpsMobileNav from '@/components/ops/OpsMobileNav';
import OpsPipelineBar from '@/components/ops/OpsPipelineBar';
import OpsSidebar from '@/components/ops/OpsSidebar';

type OpsShellProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  /** Full-height workspace layout with minimal chrome (e.g. supply workspace). */
  workspace?: boolean;
  /** Highlight active stage on the brokerage pipeline bar. */
  pipelineStage?: PipelineStageId;
};

export default function OpsShell({
  children,
  title,
  subtitle,
  workspace,
  pipelineStage,
}: OpsShellProps) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <OpsSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <OpsHeader title={title} subtitle={subtitle} />
          {pipelineStage ? <OpsPipelineBar activeStage={pipelineStage} compact={workspace} /> : null}
          <main
            className={
              workspace
                ? 'flex min-h-0 flex-1 flex-col overflow-hidden pb-20 md:pb-0'
                : 'flex-1 px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-6'
            }
          >
            {children}
          </main>
          <OpsMobileNav />
        </div>
      </div>
    </div>
  );
}
