'use client';

import { useCallback, useEffect, useState } from 'react';

type Inventory = { id: string; name: string; locality: string; configuration: string; intent: string; approvedBecause: string };
type Campaign = {
  id: string;
  projectName: string;
  locality: string;
  status: string;
  metaStatus: string;
  budgetSuggestionInr: number;
  approvedBudgetInr: number | null;
  copy: { primaryText: string; headline: string; description: string; cta: string };
  audience: { localities: string[]; configuration: string; intent: string };
  creativeBrief: { angle: string; visual: string; offer: string };
  lastError: string;
};

export default function CampaignStudioDesk() {
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [inventoryId, setInventoryId] = useState('');
  const [gate, setGate] = useState('');
  const [canReview, setCanReview] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const response = await fetch('/api/ops/growth/campaigns', { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || 'Could not load Campaign Studio.');
      return;
    }
    setInventory(data.inventory || []);
    setCampaigns(data.campaigns || []);
    setCanReview(Boolean(data.canReview));
    setGate(data.gate?.available ? 'Meta can create a paused campaign.' : (data.gate?.message || 'Meta permissions are not available.'));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function post(body: Record<string, unknown>) {
    setError('');
    setMessage('');
    const response = await fetch('/api/ops/growth/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || 'The action was refused.');
      await load();
      return;
    }
    setMessage(body.action === 'activate' ? 'Campaign activated.' : 'Saved.');
    setConfirm('');
    await load();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">{gate}</p>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      <section className="rounded-md border border-slate-200 bg-white p-3">
        <h2 className="text-sm font-semibold">Approved inventory</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <select className="rounded border border-slate-300 px-2 py-1 text-sm" value={inventoryId} onChange={(event) => setInventoryId(event.target.value)}>
            <option value="">Choose a project or listing</option>
            {inventory.map((item) => (
              <option key={item.id} value={item.id}>{item.name}{item.locality ? ` · ${item.locality}` : ''} · {item.intent}</option>
            ))}
          </select>
          <button type="button" className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white" onClick={() => post({ action: 'generate', inventoryId })}>Generate proposal</button>
        </div>
      </section>
      <ul className="space-y-3">
        {campaigns.map((campaign) => (
          <li key={campaign.id} className="rounded-md border border-slate-200 bg-white p-3 text-sm">
            <p className="font-semibold">{campaign.projectName} · {campaign.status} · Meta {campaign.metaStatus}</p>
            <p className="mt-1">{campaign.copy.headline}</p>
            <p className="text-slate-600">{campaign.copy.primaryText}</p>
            <p className="mt-1 text-slate-500">Audience: {campaign.audience.intent}, {campaign.audience.configuration || 'any configuration'}, {campaign.audience.localities.join(', ')}</p>
            <p className="text-slate-500">Suggested budget ₹{campaign.budgetSuggestionInr}/day. Approved {campaign.approvedBudgetInr ?? '—'}. Brief: {campaign.creativeBrief.visual}</p>
            {campaign.lastError ? <p className="text-rose-700">{campaign.lastError}</p> : null}
            {canReview && campaign.status === 'draft' ? (
              <div className="mt-2 flex gap-2">
                <button type="button" className="rounded border px-2 py-1" onClick={() => post({ action: 'approve', id: campaign.id })}>Approve</button>
                <button type="button" className="rounded border px-2 py-1" onClick={() => post({ action: 'reject', id: campaign.id })}>Reject</button>
              </div>
            ) : null}
            {canReview && campaign.status === 'approved' ? (
              <button type="button" className="mt-2 rounded border px-2 py-1" onClick={() => post({ action: 'create_paused', id: campaign.id })}>Create on Meta as paused</button>
            ) : null}
            {canReview && campaign.status === 'paused_on_meta' ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <input className="rounded border px-2 py-1" placeholder="Type ACTIVATE" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
                <button type="button" className="rounded border px-2 py-1" onClick={() => post({ action: 'activate', id: campaign.id, confirm })}>Activate</button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
