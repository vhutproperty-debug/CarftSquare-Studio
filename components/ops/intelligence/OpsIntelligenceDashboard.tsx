'use client';

import { useEffect, useState } from 'react';
import type { OpsIntelligenceOverview } from '@/lib/ops/intelligence/query';
import { formatOpsCurrency } from '@/components/ops/format';

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

const ALERT_TONES = {
  high: 'border-red-200 bg-red-50 text-red-900',
  medium: 'border-amber-200 bg-amber-50 text-amber-900',
  low: 'border-slate-200 bg-slate-50 text-slate-700',
};

export default function OpsIntelligenceDashboard() {
  const [data, setData] = useState<OpsIntelligenceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/ops/intelligence/overview', { credentials: 'include' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) { setError(json.error || 'Unable to load intelligence.'); return; }
        setData(json);
      } catch { setError('Unable to load intelligence.'); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) return <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">Loading operations intelligence…</div>;
  if (error) return <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      {data.alerts.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Active alerts</p>
          {data.alerts.map((alert) => (
            <div key={alert.message} className={`rounded-lg border px-4 py-3 text-sm font-medium ${ALERT_TONES[alert.level]}`}>
              {alert.message}
            </div>
          ))}
        </div>
      ) : null}

      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Pipeline readiness</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Demand ready" value={data.pipeline.demandReady} sub="Ready for matching" />
          <MetricCard label="Supply ready" value={data.pipeline.supplyReady} sub="Available inventory" />
          <MetricCard label="Active matches" value={data.pipeline.activeMatches} />
          <MetricCard label="Active deals" value={data.pipeline.activeDeals} />
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Revenue & collections</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Expected revenue" value={formatOpsCurrency(data.revenue.expectedRevenue)} />
          <MetricCard label="Pending brokerage" value={formatOpsCurrency(data.revenue.pendingBrokerage)} />
          <MetricCard label="Collected" value={formatOpsCurrency(data.revenue.collectedRevenue)} />
          <MetricCard label="Overdue" value={data.revenue.overdueCount} />
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Agreements & renewals</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Agreements signed" value={data.agreements.signed} />
          <MetricCard label="Expiring soon" value={data.agreements.expiringSoon} />
          <MetricCard label="Renewals due" value={data.renewals.dueNow} />
          <MetricCard label="Renewals lapsed" value={data.renewals.lapsed} />
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Broker leaderboard</p>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Broker</th>
                <th className="px-4 py-3">Active deals</th>
                <th className="px-4 py-3">Expected</th>
                <th className="px-4 py-3">Collected</th>
                <th className="px-4 py-3">Pending</th>
              </tr>
            </thead>
            <tbody>
              {data.brokerLeaderboard.length ? data.brokerLeaderboard.map((b) => (
                <tr key={b.brokerId} className="border-b border-slate-100">
                  <td className="px-4 py-3 font-semibold">{b.brokerName}</td>
                  <td className="px-4 py-3">{b.deals}</td>
                  <td className="px-4 py-3">{formatOpsCurrency(b.expectedRevenue)}</td>
                  <td className="px-4 py-3">{formatOpsCurrency(b.collectedRevenue)}</td>
                  <td className="px-4 py-3 font-semibold">{formatOpsCurrency(b.pendingRevenue)}</td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No broker revenue data yet — sync revenue from deals.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
