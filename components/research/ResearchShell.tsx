'use client';

import type { ReactNode } from 'react';
import ResearchHeader from '@/components/research/ResearchHeader';
import ResearchMobileNav from '@/components/research/ResearchMobileNav';
import ResearchSidebar, { useResearchSidebarState } from '@/components/research/ResearchSidebar';

type Props = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  userLabel?: string;
  /** Tighter main padding for immersive AI workspace pages. */
  dense?: boolean;
};

export default function ResearchShell({
  children,
  title,
  subtitle,
  actions,
  userLabel,
  dense = false,
}: Props) {
  const sidebar = useResearchSidebarState();

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-50/40 via-slate-100 to-slate-100 text-slate-900 dark:from-slate-900 dark:via-slate-950 dark:to-slate-950 dark:text-slate-100">
      <div className="flex min-h-screen">
        <ResearchSidebar
          collapsed={sidebar.collapsed}
          onCollapsedChange={sidebar.onCollapsedChange}
          mobileOpen={sidebar.mobileOpen}
          onMobileOpenChange={sidebar.onMobileOpenChange}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <ResearchHeader
            title={title}
            subtitle={subtitle}
            actions={actions}
            userLabel={userLabel}
            onOpenMobileNav={() => sidebar.onMobileOpenChange(true)}
          />
          <main
            className={
              dense
                ? 'flex-1 px-3 py-3 pb-24 md:px-4 md:py-4 md:pb-4'
                : 'flex-1 px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-6'
            }
          >
            {children}
          </main>
          <ResearchMobileNav onOpenMenu={() => sidebar.onMobileOpenChange(true)} />
        </div>
      </div>
    </div>
  );
}
