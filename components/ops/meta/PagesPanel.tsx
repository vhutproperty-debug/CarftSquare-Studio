'use client';

import { useCallback, useEffect, useState } from 'react';
import MetaNotice from '@/components/ops/meta/MetaNotice';
import { opsFetch } from '@/components/ops/meta/ops-fetch';

type LeadForm = {
  id: string;
  name: string;
  status: string;
};

type AccessiblePage = {
  id: string;
  name: string;
  category: string;
  fanCount: number | null;
  leadForms: LeadForm[];
  leadFormsError?: string;
  permissionPending: boolean;
  configured: boolean;
};

const counts = new Intl.NumberFormat('en-IN');

export default function PagesPanel() {
  const [pages, setPages] = useState<AccessiblePage[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await opsFetch('/api/ops/meta/pages');
    setLoading(false);
    if (!result.ok) {
      setPages([]);
      setError(typeof result.data.error === 'string' ? result.data.error : 'Unable to list Pages.');
      return;
    }
    setPages(Array.isArray(result.data.pages) ? result.data.pages as AccessiblePage[] : []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section id="pages" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          pages_show_list reads /me/accounts. pages_read_engagement reads fan count and lead forms.
        </p>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <MetaNotice error={error} />
      {pages.map((page) => (
        <article key={page.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {page.name}
                {page.configured ? <span className="ml-2 text-xs font-semibold text-emerald-700">Configured</span> : null}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {page.id}{page.category ? ` · ${page.category}` : ''}
              </p>
            </div>
            <p className="text-sm font-semibold text-slate-800">
              {page.fanCount == null ? 'Fan count unavailable' : `${counts.format(page.fanCount)} fans`}
            </p>
          </div>
          {page.leadFormsError ? (
            <div className="mt-3">
              <MetaNotice error={page.leadFormsError} />
            </div>
          ) : null}
          <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">Lead forms</h3>
          {page.leadForms.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No lead forms returned for this Page.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {page.leadForms.map((form) => (
                <li key={form.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="text-sm font-semibold text-slate-900">{form.name}</p>
                  <p className="text-[11px] text-slate-500">{form.id}{form.status ? ` · ${form.status}` : ''}</p>
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}
      {!loading && pages.length === 0 && !error ? (
        <p className="text-sm text-slate-500">The system user cannot access any Pages.</p>
      ) : null}
    </section>
  );
}
