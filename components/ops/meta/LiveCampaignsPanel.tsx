'use client';

import { useCallback, useEffect, useState } from 'react';
import MetaNotice from '@/components/ops/meta/MetaNotice';
import { opsFetch } from '@/components/ops/meta/ops-fetch';

type LiveCampaign = {
  id: string;
  name: string;
  status: string;
  effectiveStatus: string;
  objective: string;
};

export default function LiveCampaignsPanel() {
  const [adAccountId, setAdAccountId] = useState('');
  const [campaigns, setCampaigns] = useState<LiveCampaign[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await opsFetch('/api/ops/ads/live-campaigns');
    setLoading(false);
    if (!result.ok) {
      setCampaigns([]);
      setError(typeof result.data.error === 'string' ? result.data.error : 'Unable to list campaigns.');
      return;
    }
    setAdAccountId(typeof result.data.adAccountId === 'string' ? result.data.adAccountId : '');
    setCampaigns(Array.isArray(result.data.campaigns) ? result.data.campaigns as LiveCampaign[] : []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(campaign: LiveCampaign, action: 'pause' | 'resume') {
    setBusyId(campaign.id);
    setError('');
    setMessage('');
    const result = await opsFetch('/api/ops/ads/live-campaigns', {
      method: 'POST',
      body: JSON.stringify({ campaignId: campaign.id, action }),
    });
    setBusyId('');
    if (!result.ok) {
      setError(typeof result.data.error === 'string' ? result.data.error : 'Unable to update the campaign.');
      return;
    }
    setMessage(action === 'pause'
      ? `${campaign.name} is paused.`
      : `${campaign.name} is active.`);
    await load();
  }

  return (
    <section id="campaigns" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Campaigns</h2>
          <p className="mt-1 text-xs text-slate-500">
            ads_management on {adAccountId || 'the ad account'}. Pause always applies. Resume stays off unless META_ADS_ENABLED and META_ADS_ALLOW_ACTIVE are both true.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>
      <div className="mt-3">
        <MetaNotice error={error} message={message} />
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-3 font-semibold">Campaign</th>
              <th className="py-2 pr-3 font-semibold">Status</th>
              <th className="py-2 pr-3 font-semibold">Delivery</th>
              <th className="py-2 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign) => {
              const paused = campaign.status === 'PAUSED';
              const active = campaign.status === 'ACTIVE';
              const busy = busyId === campaign.id;
              return (
                <tr key={campaign.id} className="border-b border-slate-100">
                  <td className="py-3 pr-3">
                    <p className="font-semibold text-slate-900">{campaign.name}</p>
                    <p className="text-[11px] text-slate-500">{campaign.id} · {campaign.objective || '—'}</p>
                  </td>
                  <td className="py-3 pr-3 text-slate-700">{campaign.status || '—'}</td>
                  <td className="py-3 pr-3 text-slate-700">{campaign.effectiveStatus || '—'}</td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy || paused}
                        onClick={() => setStatus(campaign, 'pause')}
                        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 disabled:opacity-50"
                      >
                        Pause
                      </button>
                      <button
                        type="button"
                        disabled={busy || active}
                        onClick={() => setStatus(campaign, 'resume')}
                        className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Resume
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {loading ? <p className="py-4 text-sm text-slate-500">Loading campaigns…</p> : null}
        {!loading && campaigns.length === 0 && !error ? (
          <p className="py-4 text-sm text-slate-500">No campaigns on this ad account.</p>
        ) : null}
      </div>
    </section>
  );
}
