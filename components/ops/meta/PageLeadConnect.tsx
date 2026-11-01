'use client';

import { useCallback, useEffect, useState } from 'react';
import MetaNotice from '@/components/ops/meta/MetaNotice';
import { opsFetch, type OpsPayload } from '@/components/ops/meta/ops-fetch';

type SubscriptionApp = {
  id: string;
  name: string;
  subscribedFields: string[];
};

export default function PageLeadConnect() {
  const [pageId, setPageId] = useState('');
  const [leadgenSubscribed, setLeadgenSubscribed] = useState(false);
  const [apps, setApps] = useState<SubscriptionApp[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'connect' | 'unsubscribe' | ''>('');

  const applySubscription = useCallback((data: OpsPayload) => {
    setPageId(typeof data.pageId === 'string' ? data.pageId : '');
    setLeadgenSubscribed(data.leadgenSubscribed === true);
    setApps(Array.isArray(data.apps) ? data.apps as SubscriptionApp[] : []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await opsFetch('/api/ops/ads/page-subscription');
    setLoading(false);
    if (!result.ok) {
      setLeadgenSubscribed(false);
      setApps([]);
      setError(typeof result.data.error === 'string' ? result.data.error : 'Unable to read the Page subscription.');
      return;
    }
    applySubscription(result.data);
  }, [applySubscription]);

  useEffect(() => {
    load();
  }, [load]);

  async function connect() {
    setBusy('connect');
    setError('');
    setMessage('');
    const result = await opsFetch('/api/ops/ads/page-subscription', { method: 'POST' });
    setBusy('');
    if (!result.ok) {
      setError(typeof result.data.error === 'string' ? result.data.error : 'Unable to connect the Page.');
      return;
    }
    applySubscription(result.data);
    setMessage('Page connected for leads. leadgen is subscribed.');
  }

  async function unsubscribe() {
    if (typeof window !== 'undefined' && !window.confirm('Unsubscribe this Page from the app’s leadgen webhook?')) {
      return;
    }
    setBusy('unsubscribe');
    setError('');
    setMessage('');
    const result = await opsFetch('/api/ops/ads/page-subscription', { method: 'DELETE' });
    setBusy('');
    if (!result.ok) {
      setError(typeof result.data.error === 'string' ? result.data.error : 'Unable to unsubscribe the Page.');
      return;
    }
    const subscription = result.data.subscription;
    if (subscription && typeof subscription === 'object') {
      applySubscription(subscription as OpsPayload);
    } else {
      setLeadgenSubscribed(false);
      setApps([]);
    }
    setMessage('Page unsubscribed.');
  }

  const fields = apps.flatMap((app) => app.subscribedFields);
  const fieldLabel = fields.length ? Array.from(new Set(fields)).join(', ') : 'none';

  return (
    <section id="page-connect" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Leads webhook</h2>
          <p className="mt-1 text-xs text-slate-500">
            pages_manage_metadata. Connect uses the Page token to POST /{pageId || 'page'}/subscribed_apps with subscribed_fields=leadgen.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={connect}
            disabled={busy !== ''}
            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {busy === 'connect' ? 'Connecting…' : 'Connect Page for leads'}
          </button>
          <button
            type="button"
            onClick={unsubscribe}
            disabled={busy !== ''}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 disabled:opacity-50"
          >
            {busy === 'unsubscribe' ? 'Unsubscribing…' : 'Unsubscribe'}
          </button>
        </div>
      </div>
      <div className="mt-3">
        <MetaNotice error={error} message={message} />
      </div>
      <p className="mt-3 text-sm text-slate-700">
        {loading ? 'Checking subscription…' : (
          <>
            Page {pageId || '—'} is{' '}
            <span className={leadgenSubscribed ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-800'}>
              {leadgenSubscribed ? 'subscribed to leadgen' : 'not subscribed to leadgen'}
            </span>
            . Subscribed fields: {fieldLabel}.
          </>
        )}
      </p>
    </section>
  );
}
