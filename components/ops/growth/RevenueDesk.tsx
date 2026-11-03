'use client';

import { useEffect, useState } from 'react';

type Report = {
  campaignId: string;
  projectName: string;
  spend: number | null;
  qualifiedLeads: number;
  siteVisits: number;
  deals: number;
  collected: number;
  costPerQualifiedLead: number | null;
  costPerSiteVisit: number | null;
  roi: number | null;
};

export default function RevenueDesk() {
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState('');
  const [spendError, setSpendError] = useState('');

  useEffect(() => {
    fetch('/api/ops/growth/revenue', { cache: 'no-store' })
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) setError(data.error || 'Could not load revenue attribution.');
        else {
          setReports(data.reports || []);
          setSpendError(data.spendError || '');
        }
      })
      .catch(() => setError('Could not load revenue attribution.'));
  }, []);

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Collected brokerage counts only verified payments. Spend is read from Meta and is not changed here.</p>
      {spendError ? <p className="text-sm text-amber-800">{spendError} Costs and ROI stay blank until spend can be read.</p> : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <ul className="space-y-2">
        {reports.map((row) => (
          <li key={row.campaignId} className="rounded-md border border-slate-200 bg-white p-3 text-sm">
            <p className="font-semibold">{row.projectName || row.campaignId}</p>
            <p>Spend {row.spend ?? '—'} · qualified {row.qualifiedLeads} · visits {row.siteVisits} · deals {row.deals}</p>
            <p>Collected ₹{row.collected} · cost / qualified lead {row.costPerQualifiedLead ?? '—'} · cost / visit {row.costPerSiteVisit ?? '—'} · ROI {row.roi ?? '—'}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
