'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import LeadSourceBadge from '@/components/ops/leads/LeadSourceBadge';
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
        Loading dashboard…
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

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total leads" value={stats.totalLeads} />
        <StatCard label="Today" value={stats.leadsToday} />
        <StatCard label="Last 7 days" value={stats.leadsLast7Days} />
        <StatCard
          label="Sources online"
          value={OPS_LEAD_SOURCES.filter((source) => stats.sourceHealth[source] !== 'error').length}
          suffix={` / ${OPS_LEAD_SOURCES.length}`}
        />
      </div>

      {callMetrics ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Calling today</h2>
            <Button asChild size="sm" variant="outline">
              <Link href="/ops/calls">Open calls workspace</Link>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Calls due today" value={callMetrics.callsDueToday} />
            <StatCard label="Overdue follow-ups" value={callMetrics.overdueFollowUps} />
            <StatCard label="Not called" value={callMetrics.notCalled} />
            <StatCard label="Interested" value={callMetrics.interested} />
            <StatCard label="Calls logged today" value={callMetrics.callsLoggedToday} />
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Source breakdown</CardTitle>
            <Button asChild size="sm">
              <Link href="/ops/leads">
                View all leads
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
              Latest leads
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.latestLeads.length ? stats.latestLeads.map((lead) => (
              <LatestLeadRow key={`${lead.source}:${lead.sourceId}`} lead={lead} />
            )) : (
              <p className="text-sm text-slate-500">No leads found yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
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
