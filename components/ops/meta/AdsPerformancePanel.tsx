'use client';

import { useCallback, useEffect, useState } from 'react';
import MetaNotice from '@/components/ops/meta/MetaNotice';
import { opsFetch } from '@/components/ops/meta/ops-fetch';

type InsightRow = {
  campaignId: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  cpl: number | null;
};

const PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7d', label: 'Last 7 days' },
  { value: 'last_14d', label: 'Last 14 days' },
  { value: 'last_30d', label: 'Last 30 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'custom', label: 'Custom range' },
] as const;

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});
const counts = new Intl.NumberFormat('en-IN');

function money(value: number) {
  return inr.format(value);
}

export default function AdsPerformancePanel() {
  const [preset, setPreset] = useState<(typeof PRESETS)[number]['value']>('last_7d');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [adAccountId, setAdAccountId] = useState('');
  const [rows, setRows] = useState<InsightRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (next: { preset: string; since: string; until: string }) => {
    if (next.preset === 'custom' && (!next.since || !next.until)) {
      setError('Choose a start and end date.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (next.preset === 'custom') {
      params.set('since', next.since);
      params.set('until', next.until);
    } else {
      params.set('preset', next.preset);
    }
    const result = await opsFetch(`/api/ops/ads/insights?${params.toString()}`);
    setLoading(false);
    if (!result.ok) {
      setRows([]);
      setError(typeof result.data.error === 'string' ? result.data.error : 'Unable to read insights.');
      return;
    }
    setAdAccountId(typeof result.data.adAccountId === 'string' ? result.data.adAccountId : '');
    setRows(Array.isArray(result.data.campaigns) ? result.data.campaigns as InsightRow[] : []);
  }, []);

  useEffect(() => {
    load({ preset: 'last_7d', since: '', until: '' });
  }, [load]);

  return (
    <section id="performance" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Performance</h2>
          <p className="mt-1 text-xs text-slate-500">
            ads_read from {adAccountId || 'the ad account'} /insights. Spend, impressions, clicks, leads, and cost per lead.
          </p>
        </div>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            load({ preset, since, until });
          }}
        >
          <label className="text-xs font-semibold text-slate-600">
            Date range
            <select
              className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900"
              value={preset}
              onChange={(event) => setPreset(event.target.value as (typeof PRESETS)[number]['value'])}
            >
              {PRESETS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          {preset === 'custom' ? (
            <>
              <label className="text-xs font-semibold text-slate-600">
                From
                <input
                  type="date"
                  required
                  value={since}
                  onChange={(event) => setSince(event.target.value)}
                  className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900"
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                To
                <input
                  type="date"
                  required
                  value={until}
                  onChange={(event) => setUntil(event.target.value)}
                  className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900"
                />
              </label>
            </>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            Load performance
          </button>
        </form>
      </div>
      <div className="mt-3">
        <MetaNotice error={error} />
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-3 font-semibold">Campaign</th>
              <th className="py-2 pr-3 font-semibold">Spend</th>
              <th className="py-2 pr-3 font-semibold">Impressions</th>
              <th className="py-2 pr-3 font-semibold">Clicks</th>
              <th className="py-2 pr-3 font-semibold">Leads</th>
              <th className="py-2 font-semibold">CPL</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.campaignId} className="border-b border-slate-100">
                <td className="py-3 pr-3">
                  <p className="font-semibold text-slate-900">{row.campaignName}</p>
                  <p className="text-[11px] text-slate-500">{row.campaignId}</p>
                </td>
                <td className="py-3 pr-3">{money(row.spend)}</td>
                <td className="py-3 pr-3">{counts.format(row.impressions)}</td>
                <td className="py-3 pr-3">{counts.format(row.clicks)}</td>
                <td className="py-3 pr-3">{counts.format(row.leads)}</td>
                <td className="py-3">{row.cpl == null ? '—' : money(row.cpl)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading ? <p className="py-4 text-sm text-slate-500">Loading insights…</p> : null}
        {!loading && rows.length === 0 && !error ? (
          <p className="py-4 text-sm text-slate-500">No campaign insights for this date range.</p>
        ) : null}
      </div>
    </section>
  );
}
