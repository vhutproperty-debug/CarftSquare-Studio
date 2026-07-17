'use client';

import type { ReactNode } from 'react';
import type { PipelineStageId } from '@/lib/ops/business';
import OpsHeader from '@/components/ops/OpsHeader';
import OpsMobileNav from '@/components/ops/OpsMobileNav';
import OpsPipelineBar from '@/components/ops/OpsPipelineBar';
import OpsSidebar, { useOpsSidebarState } from '@/components/ops/OpsSidebar';

type OpsShellProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Full-height workspace layout with minimal chrome (e.g. supply workspace). */
  workspace?: boolean;
  /** Tighter header/padding for high-density ops screens. */
  dense?: boolean;
  /** Highlight active stage on the brokerage pipeline bar. */
  pipelineStage?: PipelineStageId;
};

export default function OpsShell({
  children,
  title,
  subtitle,
  actions,
  workspace,
  dense = false,
  pipelineStage,
}: OpsShellProps) {
  const sidebar = useOpsSidebarState();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <OpsSidebar
          collapsed={sidebar.collapsed}
          onCollapsedChange={sidebar.onCollapsedChange}
          mobileOpen={sidebar.mobileOpen}
          onMobileOpenChange={sidebar.onMobileOpenChange}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <OpsHeader
            title={title}
            subtitle={subtitle}
            actions={actions}
            dense={dense || Boolean(workspace)}
            onOpenMobileNav={() => sidebar.onMobileOpenChange(true)}
          />
          {pipelineStage ? <OpsPipelineBar activeStage={pipelineStage} compact /> : null}
          <main
            className={
              workspace
                ? 'flex min-h-0 flex-1 flex-col overflow-hidden pb-20 md:pb-0'
                : dense
                  ? 'flex-1 px-3 py-3 pb-24 md:px-5 md:py-4 md:pb-4'
                  : 'flex-1 px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-6'
            }
          >
            {children}
          </main>
          <OpsMobileNav onOpenMenu={() => sidebar.onMobileOpenChange(true)} />
        </div>
      </div>
    </div>
  );
}
