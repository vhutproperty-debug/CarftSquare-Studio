'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { Bookmark, History, Plug, Search, Sparkles } from 'lucide-react';
import ExecutionDashboardPanel from '@/components/research/ExecutionDashboardPanel';
import KnowledgeGraphPanel from '@/components/research/KnowledgeGraphPanel';
import MarketWatchPanel from '@/components/research/MarketWatchPanel';
import ResearchEmptyState from '@/components/research/ResearchEmptyState';
import ResearchShell from '@/components/research/ResearchShell';
import ResearchStatCard from '@/components/research/ResearchStatCard';
import { RESEARCH_DASHBOARD_PLACEHOLDERS } from '@/lib/research/business';
import '@/styles/research/workspace.css';

const QUICK_ACTIONS = [
  {
    href: '/research/research',
    label: 'New research',
    description: 'Delegate research to the executive AI analyst',
    icon: Search,
  },
  {
    href: '/research/watches',
    label: 'Create a watch',
    description: 'Monitor projects and queries continuously',
    icon: Bookmark,
  },
  {
    href: '/research/connectors',
    label: 'Connect a portal',
    description: 'Link Housing, 99acres, and other sources',
    icon: Plug,
  },
  {
    href: '/research/notifications',
    label: 'View alerts',
    description: 'Evidence-backed market notifications',
    icon: History,
  },
] as const;

type Props = {
  userLabel?: string;
};

type DashboardStats = {
  researchRuns: number;
  connectedPortals: number;
  recentSearches: number;
  savedSearches: number;
  todaysActivity: number;
  aiSessions: number;
};

export default function ResearchDashboard({ userLabel }: Props) {
  const [stats, setStats] = useState<DashboardStats>({
    ...RESEARCH_DASHBOARD_PLACEHOLDERS,
    aiSessions: 0,
  });

  const onStats = useCallback((next: DashboardStats) => {
    setStats(next);
  }, []);

  return (
    <ResearchShell
      title="Dashboard"
      subtitle="Prop/Research workspace overview"
      userLabel={userLabel}
      actions={
        <Link
          href="/research/research"
          className="inline-flex h-8 items-center rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
        >
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          Start research
        </Link>
      }
    >
      <div className="research-workspace mx-auto max-w-7xl space-y-8">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <ResearchStatCard label="Research Runs" value={stats.researchRuns} hint="Completed portal runs" />
          <ResearchStatCard
            label="Connected Portals"
            value={stats.connectedPortals}
            hint="Authenticated connectors"
          />
          <ResearchStatCard
            label="Recent Searches"
            value={stats.recentSearches}
            hint="Query history"
          />
          <ResearchStatCard
            label="AI Sessions"
            value={stats.aiSessions}
            hint="Conversational research"
          />
          <ResearchStatCard
            label="Today's Activity"
            value={stats.todaysActivity}
            hint="Sessions updated today"
          />
        </div>

        <MarketWatchPanel />

        <ExecutionDashboardPanel onStats={onStats} />

        <KnowledgeGraphPanel />

        <section>
          <h2 className="mb-4 text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Quick actions
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="research-panel rounded-2xl p-5 transition hover:-translate-y-0.5 hover:border-orange-200 dark:hover:border-orange-900"
                >
                  <Icon className="h-4 w-4 text-orange-600" />
                  <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {action.label}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {action.description}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <ResearchEmptyState
            title="Need inventory?"
            description="Ask the executive analyst in plain language. It plans, searches authenticated portals, scores matches, and writes a client-ready report."
            action={
              <Link
                href="/research/research"
                className="inline-flex h-8 items-center rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800"
              >
                Open Research
              </Link>
            }
          />
          <ResearchEmptyState
            title="Portal sessions"
            description="Authenticate portals once. The analyst reuses encrypted browser sessions for every follow-up."
            action={
              <Link
                href="/research/connectors"
                className="inline-flex h-8 items-center rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
              >
                View Connectors
              </Link>
            }
          />
        </section>
      </div>
    </ResearchShell>
  );
}
