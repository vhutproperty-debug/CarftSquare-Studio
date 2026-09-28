'use client';

import { useCallback, useEffect, useState } from 'react';
import OpsShell from '@/components/ops/OpsShell';

type Readiness = {
  dryRunOnly: true;
  activeSpendAllowed: boolean;
  tokenConfigured: boolean;
  businessId: string;
  adAccountId: string;
  pageId: string;
  pixelId: string;
  permissions: string[];
  hasAdsManagement: boolean;
  canPublishPaused: boolean;
  blockers: string[];
  warnings: string[];
};

type Creative = {
  id: string;
  offer: string;
  audienceHint: string;
  areas: string[];
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
  angle: string;
  status: string;
  createdAt: string;
};

type Campaign = {
  id: string;
  name: string;
  creativeId: string;
  status: string;
  metaStatus: string;
  dailyBudgetInr: number;
  metaCampaignId?: string;
  metaAdId?: string;
  lastError?: string;
  createdAt: string;
};

export default function OpsMetaAdsPage() {
  return (
    <OpsShell
      title="Meta Ads (Dry-run)"
      subtitle="Generate creatives, approve, and publish PAUSED Lead campaigns — no spend until you unlock."
      workspace
      pipelineStage="demand"
    >
      <MetaAdsWorkspace />
    </OpsShell>
  );
}

function MetaAdsWorkspace() {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [offer, setOffer] = useState(
    'Just checking if your apartment is available for rent or resale.',
  );
  const [areas, setAreas] = useState('Mumbai, Goregaon West');
  const [campaignName, setCampaignName] = useState('CraftSquare Leads — Dry Run');
  const [selectedCreativeId, setSelectedCreativeId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    const [sRes, cRes, campRes] = await Promise.all([
      fetch('/api/ops/ads/status', { credentials: 'include' }),
      fetch('/api/ops/ads/creatives', { credentials: 'include' }),
      fetch('/api/ops/ads/campaigns', { credentials: 'include' }),
    ]);
    const sData = await sRes.json().catch(() => ({}));
    const cData = await cRes.json().catch(() => ({}));
    const campData = await campRes.json().catch(() => ({}));
    if (!sRes.ok) {
      setError(sData.error || 'Unable to load Meta Ads status.');
      return;
    }
    setReadiness(sData.readiness || null);
    setCreatives(cData.creatives || []);
    setCampaigns(campData.campaigns || []);
    const approved = (cData.creatives || []).find((c: Creative) => c.status === 'approved');
    if (approved && !selectedCreativeId) setSelectedCreativeId(approved.id);
  }, [selectedCreativeId]);

  useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    setBusy(true);
    setMessage('');
    setError('');
    const res = await fetch('/api/ops/ads/creatives', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offer,
        audienceHint: 'Homeowners',
        areas: areas.split(/[,]/).map((a) => a.trim()).filter(Boolean),
        count: 5,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || 'Generate failed');
      return;
    }
    setMessage(`Generated ${data.creatives?.length || 0} creatives (draft). Approve one to continue.`);
    await load();
  }

  async function setCreativeAction(id: string, action: 'approve' | 'reject') {
    setBusy(true);
    setError('');
    const res = await fetch(`/api/ops/ads/creatives/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : 'Update failed');
      return;
    }
    if (action === 'approve') setSelectedCreativeId(id);
    setMessage(action === 'approve' ? 'Creative approved.' : 'Creative rejected.');
    await load();
  }

  async function createCampaign() {
    if (!selectedCreativeId) {
      setError('Approve and select a creative first.');
      return;
    }
    setBusy(true);
    setError('');
    const res = await fetch('/api/ops/ads/campaigns', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: campaignName,
        creativeId: selectedCreativeId,
        areas: areas.split(/[,]/).map((a) => a.trim()).filter(Boolean),
        destination: 'instant_form',
        dailyBudgetInr: 500,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : 'Create campaign failed');
      return;
    }
    setMessage('Dry-run campaign record created (ready). Next: Publish PAUSED.');
    await load();
  }

  async function publishPaused(id: string) {
    setBusy(true);
    setError('');
    setMessage('');
    const res = await fetch('/api/ops/ads/campaigns', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'publish_paused' }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || 'Publish paused failed');
      await load();
      return;
    }
    setMessage(
      `Published PAUSED on Meta. Campaign ${data.result?.metaCampaignId || ''} — no spend.`,
    );
    await load();
  }

  return (
    <div className="space-y-6">
      {readiness && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-900">Readiness</p>
              <p className="mt-1 text-xs text-slate-500">
                {readiness.adAccountId} · Page {readiness.pageId} · Pixel {readiness.pixelId}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                readiness.canPublishPaused
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-800'
              }`}
            >
              {readiness.canPublishPaused ? 'Can publish PAUSED' : 'Blocked — token / permissions'}
            </span>
          </div>
          <p className="mt-3 text-xs text-slate-600">
            Dry-run only. Active spend locked ({readiness.activeSpendAllowed ? 'UNLOCKED' : 'locked'}).
            Permissions: {readiness.permissions.join(', ') || 'none'}
          </p>
          {!!readiness.blockers.length && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-rose-700">
              {readiness.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
          {!!readiness.warnings.length && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-500">
              {readiness.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(message || error) && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {error || message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">1. Creative Studio</h2>
          <p className="mt-1 text-xs text-slate-500">Generate copy pack → approve one. No Meta spend.</p>
          <label className="mt-4 block text-xs font-semibold text-slate-600">Offer / message intent</label>
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            rows={3}
            value={offer}
            onChange={(e) => setOffer(e.target.value)}
          />
          <label className="mt-3 block text-xs font-semibold text-slate-600">Areas</label>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={areas}
            onChange={(e) => setAreas(e.target.value)}
          />
          <button
            type="button"
            disabled={busy}
            onClick={generate}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Generate 5 creatives
          </button>

          <div className="mt-4 max-h-96 space-y-3 overflow-y-auto">
            {creatives.map((c) => (
              <div key={c.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{c.headline}</p>
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">
                      {c.status} · {c.angle}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-xs font-semibold text-emerald-700"
                      onClick={() => setCreativeAction(c.id, 'approve')}
                      disabled={busy || c.status === 'approved'}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="text-xs font-semibold text-rose-700"
                      onClick={() => setCreativeAction(c.id, 'reject')}
                      disabled={busy}
                    >
                      Reject
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-600">{c.primaryText}</p>
              </div>
            ))}
            {!creatives.length && <p className="text-sm text-slate-500">No creatives yet.</p>}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">2. Campaign Factory (PAUSED)</h2>
          <p className="mt-1 text-xs text-slate-500">
            Creates Lead objective objects on Meta as PAUSED only. Will not go ACTIVE from this screen.
          </p>
          <label className="mt-4 block text-xs font-semibold text-slate-600">Campaign name</label>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
          />
          <label className="mt-3 block text-xs font-semibold text-slate-600">Approved creative</label>
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={selectedCreativeId}
            onChange={(e) => setSelectedCreativeId(e.target.value)}
          >
            <option value="">Select…</option>
            {creatives
              .filter((c) => c.status === 'approved' || c.status === 'published')
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.headline} ({c.angle})
                </option>
              ))}
          </select>
          <button
            type="button"
            disabled={busy}
            onClick={createCampaign}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Create dry-run campaign
          </button>

          <div className="mt-4 space-y-3">
            {campaigns.map((camp) => (
              <div key={camp.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-900">{camp.name}</p>
                <p className="text-[11px] text-slate-500">
                  {camp.status} · meta {camp.metaStatus} · ₹{camp.dailyBudgetInr}/day (paused)
                </p>
                {camp.metaCampaignId && (
                  <p className="mt-1 text-[11px] text-slate-500">Meta campaign: {camp.metaCampaignId}</p>
                )}
                {camp.lastError && <p className="mt-1 text-xs text-rose-700">{camp.lastError}</p>}
                {(camp.status === 'ready' || camp.status === 'awaiting_ads_token' || camp.status === 'failed') && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => publishPaused(camp.id)}
                    className="mt-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 disabled:opacity-50"
                  >
                    Publish PAUSED to Meta
                  </button>
                )}
              </div>
            ))}
            {!campaigns.length && <p className="text-sm text-slate-500">No campaign records yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
