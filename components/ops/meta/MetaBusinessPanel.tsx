'use client';

import { useCallback, useEffect, useState } from 'react';
import MetaNotice from '@/components/ops/meta/MetaNotice';
import { opsFetch } from '@/components/ops/meta/ops-fetch';

type OwnedAdAccount = {
  id: string;
  name: string;
  accountStatusLabel: string;
  currency: string;
  configured: boolean;
  source?: string;
};

type OwnedPage = {
  id: string;
  name: string;
  fanCount: number | null;
  configured: boolean;
  source?: string;
};

type AssetRead<T> = {
  ok: boolean;
  data?: T[];
  error?: string;
  permissionPending?: boolean;
};

export default function MetaBusinessPanel() {
  const [businessId, setBusinessId] = useState('');
  const [adAccounts, setAdAccounts] = useState<AssetRead<OwnedAdAccount> | null>(null);
  const [pages, setPages] = useState<AssetRead<OwnedPage> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await opsFetch('/api/ops/meta/business');
    setLoading(false);
    const rawId = result.data.businessId;
    if (typeof rawId === 'string' && rawId) setBusinessId(rawId);
    else if (typeof rawId === 'number' && Number.isSafeInteger(rawId)) setBusinessId(String(rawId));
    if (!result.ok) {
      setAdAccounts(null);
      setPages(null);
      setError(typeof result.data.error === 'string' ? result.data.error : 'Unable to read Meta Business assets.');
      return;
    }
    setAdAccounts((result.data.adAccounts as AssetRead<OwnedAdAccount>) || null);
    setPages((result.data.pages as AssetRead<OwnedPage>) || null);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section id="assets" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-slate-600">
            business_management reads ad accounts and Pages for this business.
          </p>
          <p className="mt-1 break-all font-mono text-sm font-semibold text-slate-900">
            Business ID {businessId || '1420297320045438'}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? 'Checking…' : 'Check Meta assets'}
        </button>
      </div>
      <MetaNotice error={error} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Ad accounts</h2>
          {adAccounts && !adAccounts.ok ? (
            <div className="mt-3">
              <MetaNotice error={adAccounts.error || 'Unable to read ad accounts.'} />
            </div>
          ) : null}
          <ul className="mt-3 space-y-2">
            {(adAccounts?.ok ? adAccounts.data || [] : []).map((account) => (
              <li key={account.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="text-sm font-semibold text-slate-900">{account.name}</p>
                <p className="break-all text-[11px] text-slate-500">
                  {account.id} · {account.accountStatusLabel}
                  {account.currency ? ` · ${account.currency}` : ''}
                  {account.source ? ` · ${account.source}` : ''}
                  {account.configured ? ' · configured' : ''}
                </p>
              </li>
            ))}
          </ul>
          {adAccounts?.ok && (adAccounts.data || []).length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No owned ad accounts returned.</p>
          ) : null}
          {!adAccounts ? <p className="mt-3 text-sm text-slate-500">Check Meta assets to load this list.</p> : null}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Pages</h2>
          {pages && !pages.ok ? (
            <div className="mt-3">
              <MetaNotice error={pages.error || 'Unable to read Pages.'} />
            </div>
          ) : null}
          <ul className="mt-3 space-y-2">
            {(pages?.ok ? pages.data || [] : []).map((page) => (
              <li key={page.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="text-sm font-semibold text-slate-900">{page.name}</p>
                <p className="break-all text-[11px] text-slate-500">
                  {page.id}
                  {page.fanCount == null ? '' : ` · ${page.fanCount.toLocaleString('en-IN')} fans`}
                  {page.source ? ` · ${page.source}` : ''}
                  {page.configured ? ' · configured' : ''}
                </p>
              </li>
            ))}
          </ul>
          {pages?.ok && (pages.data || []).length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No owned Pages returned.</p>
          ) : null}
          {!pages ? <p className="mt-3 text-sm text-slate-500">Check Meta assets to load this list.</p> : null}
        </div>
      </div>
    </section>
  );
}
