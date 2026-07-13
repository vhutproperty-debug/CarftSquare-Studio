'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Inbox, PhoneCall } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import OpsPipelineBar from '@/components/ops/OpsPipelineBar';
import LeadSourceBadge from '@/components/ops/leads/LeadSourceBadge';
import {
  DEMAND_CHANNELS,
  OPS_PILLARS,
  OPS_PIPELINE,
  REVENUE_STREAMS,
  SUPPLY_METHODS,
} from '@/lib/ops/business';
import type { OpsDashboardStats, NormalizedOpsLead } from '@/lib/ops/leads/types';
import type { CallWorkspaceMetrics } from '@/lib/ops/calls/types';
import { OPS_LEAD_SOURCE_LABELS, OPS_LEAD_SOURCES } from '@/lib/ops/leads/types';
import { formatPhoneDisplay } from '@/lib/ops/phone';

function formatReceivedAt(value: string) {
  try {
    return new Date(value).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return value;
  }
}

export default function OpsDashboardPanel() {
  const [stats, setStats] = useState<OpsDashboardStats | null>(null);
  const [callMetrics, setCallMetrics] = useState<CallWorkspaceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [dashboardRes, metricsRes] = await Promise.all([
          fetch('/api/ops/dashboard', { credentials: 'include' }),
          fetch('/api/ops/calls/metrics', { credentials: 'include' }),
        ]);
        const dashboardData = await dashboardRes.json().catch(() => ({}));
        const metricsData = await metricsRes.json().catch(() => ({}));
        if (!dashboardRes.ok) {
          setError(dashboardData.error || 'Unable to load dashboard.');
          return;
        }
        setStats(dashboardData.stats);
        setCallMetrics(metricsData.metrics || null);
      } catch {
        setError('Unable to load dashboard.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
        Loading operations overview…
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-6 py-8 text-sm text-rose-800">
        {error || 'Unable to load dashboard.'}
      </div>
    );
  }

  const liveDemandChannels = DEMAND_CHANNELS.filter((c) => c.live).length;
  const liveSupplyMethods = SUPPLY_METHODS.filter((m) => m.live).length;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <OpsPipelineBar />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PillarCard
          pillar="demand"
          metric={stats.leadsToday}
          metricLabel="enquiries today"
          actionHref="/ops/leads"
          actionLabel="Open Demand Inbox"
        />
        <PillarCard
          pillar="supply"
          metric={callMetrics?.notCalled ?? 0}
          metricLabel="supply prospects to call"
          actionHref="/ops/calls"
          actionLabel="Open Supply Workspace"
        />
        <PillarCard
          pillar="revenue"
          comingSoon
          detail={`${REVENUE_STREAMS.length} revenue streams planned`}
        />
        <PillarCard
          pillar="profit"
          comingSoon
          detail="Billing, payouts & incentives"
        />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{OPS_PILLARS.demand.label} — Intake</h2>
            <p className="text-sm text-slate-500">{OPS_PILLARS.demand.description}</p>
          </div>
          <Button asChild size="sm">
            <Link href="/ops/leads">
              <Inbox className="mr-2 h-4 w-4" aria-hidden="true" />
              Demand Inbox
            </Link>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total enquiries" value={stats.totalLeads} />
          <StatCard label="Today" value={stats.leadsToday} />
          <StatCard label="Last 7 days" value={stats.leadsLast7Days} />
          <StatCard
            label="Channels live"
            value={liveDemandChannels}
            suffix={` / ${DEMAND_CHANNELS.length}`}
          />
        </div>
      </section>

      {callMetrics ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{OPS_PILLARS.supply.label} — Outreach</h2>
              <p className="text-sm text-slate-500">{OPS_PILLARS.supply.description}</p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/ops/calls">
                <PhoneCall className="mr-2 h-4 w-4" aria-hidden="true" />
                Supply Workspace
              </Link>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Follow-ups due today" value={callMetrics.callsDueToday} />
            <StatCard label="Overdue" value={callMetrics.overdueFollowUps} />
            <StatCard label="New prospects" value={callMetrics.notCalled} />
            <StatCard label="Interested" value={callMetrics.interested} />
            <StatCard label="Calls logged today" value={callMetrics.callsLoggedToday} />
          </div>
          <p className="text-xs text-slate-500">
            Active supply methods: {SUPPLY_METHODS.filter((m) => m.live).map((m) => m.label).join(', ')}
            {' · '}{liveSupplyMethods} of {SUPPLY_METHODS.length} connected
          </p>
        </section>
      ) : null}

      <Card className="border-dashed border-slate-200 bg-slate-50/50">
        <CardHeader>
          <CardTitle className="text-base text-slate-700">Pipeline — Coming Next</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {OPS_PIPELINE.filter((s) => s.status === 'coming_soon').map((stage) => (
              <span
                key={stage.id}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500"
                title={stage.description}
              >
                {stage.label}
                <span className="ml-2 text-[10px] font-bold uppercase text-slate-400">Soon</span>
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Demand → Supply → Matching → Deal → Revenue → Agreement → Renewal
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Demand by source</CardTitle>
            <Button asChild size="sm" variant="outline">
              <Link href="/ops/leads">
                View inbox
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {OPS_LEAD_SOURCES.map((source) => (
              <div key={source} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <LeadSourceBadge source={source} />
                  {stats.sourceHealth[source] === 'error' ? (
                    <span className="text-xs text-amber-700">unavailable</span>
                  ) : null}
                </div>
                <span className="text-sm font-bold text-slate-900">{stats.sourceBreakdown[source] || 0}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Inbox className="h-5 w-5 text-orange-600" aria-hidden="true" />
              Latest demand enquiries
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.latestLeads.length ? stats.latestLeads.map((lead) => (
              <LatestLeadRow key={`${lead.source}:${lead.sourceId}`} lead={lead} />
            )) : (
              <p className="text-sm text-slate-500">No enquiries yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PillarCard({
  pillar,
  metric,
  metricLabel,
  actionHref,
  actionLabel,
  comingSoon,
  detail,
}: {
  pillar: keyof typeof OPS_PILLARS;
  metric?: number;
  metricLabel?: string;
  actionHref?: string;
  actionLabel?: string;
  comingSoon?: boolean;
  detail?: string;
}) {
  const info = OPS_PILLARS[pillar];
  return (
    <Card className={comingSoon ? 'border-dashed bg-slate-50/80' : ''}>
      <CardContent className="px-5 py-5">
        <p className="text-xs font-bold uppercase tracking-wide text-orange-600">{info.shortLabel}</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{info.label}</p>
        {comingSoon ? (
          <>
            <p className="mt-3 text-2xl font-black text-slate-300">—</p>
            <p className="mt-1 text-xs text-slate-500">{detail}</p>
            <span className="mt-2 inline-block rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">
              Phase 3+
            </span>
          </>
        ) : (
          <>
            <p className="mt-3 text-3xl font-black text-slate-900">{metric?.toLocaleString('en-IN')}</p>
            <p className="text-xs text-slate-500">{metricLabel}</p>
            {actionHref && actionLabel ? (
              <Button asChild size="sm" variant="link" className="mt-2 h-auto p-0 text-orange-600">
                <Link href={actionHref}>{actionLabel} →</Link>
              </Button>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatCard({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  return (
    <Card>
      <CardContent className="px-5 py-5">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-2 text-3xl font-black text-slate-900">
          {value.toLocaleString('en-IN')}
          {suffix ? <span className="text-base font-semibold text-slate-500">{suffix}</span> : null}
        </p>
      </CardContent>
    </Card>
  );
}

function LatestLeadRow({ lead }: { lead: NormalizedOpsLead }) {
  return (
    <Link
      href={`/ops/leads/${lead.source}/${lead.sourceId}`}
      className="block rounded-lg border border-slate-100 px-3 py-3 hover:bg-slate-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{lead.name || 'Unknown'}</p>
          <p className="text-sm text-slate-600">{formatPhoneDisplay(lead.phone)}</p>
          <p className="mt-1 text-xs text-slate-500">
            {OPS_LEAD_SOURCE_LABELS[lead.source]} · {formatReceivedAt(lead.createdAt)}
          </p>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      </div>
    </Link>
  );
}
