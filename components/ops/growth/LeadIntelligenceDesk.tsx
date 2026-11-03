'use client';

import { useEffect, useState } from 'react';

type Rule = { id: string; label: string; weight: number; applied: boolean; points: number };
type Row = { leadId: string; source: string; campaignId: string; engagement: { score: number; breakdown: Rule[] }; qualification: { score: number; breakdown: Rule[] } };

export default function LeadIntelligenceDesk() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/ops/growth/intelligence', { cache: 'no-store' })
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) setError(data.error || 'Could not load lead intelligence.');
        else setRows(data.rows || []);
      })
      .catch(() => setError('Could not load lead intelligence.'));
  }, []);

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Scores are sums of the weights below. Nothing is merged automatically.</p>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.leadId} className="rounded-md border border-slate-200 bg-white p-3 text-sm">
            <p className="font-semibold">{row.source} · engagement {row.engagement.score} · qualification {row.qualification.score}</p>
            <p className="text-slate-500">Campaign {row.campaignId || '—'}</p>
            <ul className="mt-1 text-slate-600">
              {[...row.engagement.breakdown, ...row.qualification.breakdown].map((rule) => (
                <li key={rule.id}>{rule.label}: {rule.applied ? 'applied' : 'not applied'} · weight {rule.weight} · points {rule.points}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
