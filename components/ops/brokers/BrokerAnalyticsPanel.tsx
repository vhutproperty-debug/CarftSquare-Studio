'use client';

import { useEffect, useState } from 'react';
import type { BrokerAnalyticsResult } from '@/lib/ops/brokers/types';

export default function BrokerAnalyticsPanel() {
  const [data, setData] = useState<BrokerAnalyticsResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/ops/brokers/analytics', { credentials: 'include' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json.error || 'Unable to load analytics.');
          return;
        }
        setData(json);
      } catch {
        setError('Unable to load analytics.');
      }
    }
    load();
  }, []);

  if (error) {
    return <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>;
  }
  if (!data) {
    return <div className="rounded-xl border bg-white p-6 text-sm text-slate-500">Loading analytics…</div>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Freshness">
        <Row label="Fresh" value={data.freshness.fresh} />
        <Row label="Aging" value={data.freshness.aging} />
        <Row label="Stale" value={data.freshness.stale} />
      </Card>
      <Card title="Rent vs sale">
        <Row label="Rent" value={data.rentVsSale.rent} />
        <Row label="Sale" value={data.rentVsSale.sale} />
        <Row label="Unknown" value={data.rentVsSale.unknown} />
        <Row label="Avg repost frequency" value={data.averageRepostFrequency} />
      </Card>
      <Card title="Top brokers">
        {data.topBrokers.map((b) => <Row key={b.brokerName} label={b.brokerName} value={b.count} />)}
      </Card>
      <Card title="Top projects">
        {data.topProjects.map((p) => <Row key={p.project} label={p.project} value={p.count} />)}
      </Card>
      <Card title="Top groups">
        {data.topGroups.map((g) => <Row key={g.groupName} label={g.groupName} value={g.count} />)}
      </Card>
      <Card title="Unknown project trends">
        {data.unknownProjectTrends.map((u) => <Row key={u.projectName} label={u.projectName} value={u.count} />)}
        {!data.unknownProjectTrends.length ? <p className="text-xs text-slate-500">None</p> : null}
      </Card>
      <Card title="Inventory age">
        {data.inventoryAgeDistribution.map((b) => <Row key={b.bucket} label={b.bucket} value={b.count} />)}
      </Card>
      <Card title="Broker activity (recent days)">
        {data.brokerActivityTrend.slice(-10).map((d) => <Row key={d.day} label={d.day} value={d.count} />)}
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{title}</h3>
      <div className="mt-2 space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="truncate text-slate-700">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}
