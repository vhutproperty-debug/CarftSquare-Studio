'use client';

import { useCallback, useEffect, useState } from 'react';
import OpsShell from '@/components/ops/OpsShell';

type DeliveryStats = {
  total: number;
  queued: number;
  submitted: number;
  pending: number;
  sent: number;
  delivered: number;
  read: number;
  temporaryFailure: number;
  retryScheduled: number;
  retrying: number;
  permanentFailure: number;
  cancelled: number;
  unknown: number;
  terminal: number;
  nonTerminal: number;
};

type Campaign = {
  id: string;
  name: string;
  templateName: string;
  status: string;
  stats: Record<string, number>;
  deliveryStats?: DeliveryStats;
  createdAt: string;
};

type Recipient = {
  id: string;
  name?: string;
  normalizedPhone: string;
  bodyValues?: string[];
  deliveryState?: string;
  status: string;
  providerMessageId?: string;
  attemptCount?: number;
  failureClass?: string | null;
  failureReason?: string | null;
  nextRetryAt?: string | null;
  reviewRequired?: boolean;
  lastError?: string;
};

export default function OpsCampaignsPage() {
  return (
    <OpsShell
      title="WhatsApp Campaigns"
      subtitle="Approved-template campaigns with delivery tracking, retries, and reconciliation."
      workspace
      pipelineStage="demand"
    >
      <CampaignsWorkspace />
    </OpsShell>
  );
}

function CampaignsWorkspace() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Array<{ name: string; label: string }>>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    campaign: Campaign;
    recipients: Recipient[];
  } | null>(null);
  const [name, setName] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [phones, setPhones] = useState('');
  const [audienceMode, setAudienceMode] = useState<'phones' | 'prospects'>('phones');
  const [projectName, setProjectName] = useState('');
  const [wave, setWave] = useState('');
  const [batch, setBatch] = useState('');
  const [priority, setPriority] = useState('');
  const [campaignTag, setCampaignTag] = useState('');
  const [variableMode, setVariableMode] = useState<'both' | 'salutation'>('both');
  const [previewText, setPreviewText] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const [cRes, sRes] = await Promise.all([
      fetch('/api/ops/campaigns', { credentials: 'include' }),
      fetch('/api/ops/whatsapp/status', { credentials: 'include' }),
    ]);
    const cData = await cRes.json().catch(() => ({}));
    const sData = await sRes.json().catch(() => ({}));
    if (!cRes.ok) {
      setError(cData.error || 'Unable to load campaigns.');
      return;
    }
    setCampaigns(cData.campaigns || []);
    const t = sData.status?.templates || [];
    setTemplates(t);
    if (!templateName && t[0]?.name) setTemplateName(t[0].name);
  }, [templateName]);

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/ops/campaigns/${id}`, { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.error || 'Unable to load campaign detail');
      return;
    }
    setDetail({ campaign: data.campaign, recipients: data.recipients || [] });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  function campaignBody(dryRun: boolean) {
    const phoneList = phones
      .split(/[\n,]/)
      .map((p) => p.trim())
      .filter(Boolean);
    const variableFields = variableMode === 'both' ? ['salutation', 'units'] : ['salutation'];
    if (audienceMode === 'prospects') {
      return {
        name,
        templateName,
        dryRun,
        throttlePerMinute: 20,
        audience: {
          source: 'ops_prospects',
          projectName,
          wave: wave.trim() ? Number(wave) : undefined,
          batch: batch.trim() || undefined,
          priority: priority || undefined,
          campaignTag: campaignTag.trim() || undefined,
          variableFields,
        },
      };
    }
    return {
      name,
      templateName,
      dryRun,
      phones: phoneList,
      throttlePerMinute: 20,
    };
  }

  async function previewCampaign() {
    setMessage('');
    setPreviewText('');
    const res = await fetch('/api/ops/campaigns', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campaignBody(true)),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(typeof data.error === 'string' ? data.error : 'Preview failed');
      return;
    }
    const preview = data.preview || {};
    const sample = (preview.recipients || []).slice(0, 8).map((row: {
      name?: string;
      phone?: string;
      status?: string;
      bodyValues?: string[];
      reason?: string;
    }) => {
      const tail = row.phone ? row.phone.slice(-4) : '';
      return `${row.status} ****${tail} ${row.name || ''} [${(row.bodyValues || []).join(' | ')}]${row.reason ? ` (${row.reason})` : ''}`;
    });
    setPreviewText(
      `Preview: ${preview.queued || 0} queued, ${preview.skipped || 0} skipped of ${preview.total || 0}. Nothing was sent.\n${sample.join('\n')}`,
    );
  }

  async function createCampaign() {
    setMessage('');
    const res = await fetch('/api/ops/campaigns', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campaignBody(false)),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(typeof data.error === 'string' ? data.error : 'Create failed');
      return;
    }
    setName('');
    setPhones('');
    setPreviewText('');
    setMessage('Draft campaign created. Start still uses the existing WhatsApp send guards.');
    await load();
  }

  async function startCampaign(id: string) {
    const res = await fetch('/api/ops/campaigns', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'start' }),
    });
    const data = await res.json().catch(() => ({}));
    setMessage(
      res.ok
        ? `Batch: sent ${data.sent || 0}, failed ${data.failed || 0}, skipped ${data.skipped || 0}`
        : data.error || 'Start failed',
    );
    await load();
    if (selectedId === id) await loadDetail(id);
  }

  async function reconcile(id: string) {
    const res = await fetch(`/api/ops/campaigns/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reconcile' }),
    });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? `Reconciled → ${data.lifecycle}` : data.error || 'Reconcile failed');
    await load();
    await loadDetail(id);
  }

  async function cancelCampaign(id: string) {
    const res = await fetch(`/api/ops/campaigns/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? 'Campaign cancelled' : data.error || 'Cancel failed');
    await load();
    await loadDetail(id);
  }

  async function retryRecipient(campaignId: string, recipientId: string) {
    const res = await fetch(`/api/ops/campaigns/${campaignId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'retry_recipient', recipientId }),
    });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? 'Manual retry executed' : data.error || 'Retry failed');
    await loadDetail(campaignId);
  }

  const stats = detail?.campaign.deliveryStats;

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <section className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Create campaign</h2>
          <p className="mt-1 text-xs text-slate-500">
            Templates only. Preview does not send. Starting a batch still uses the existing WhatsApp send guards.
          </p>
          <div className="mt-3 flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setAudienceMode('phones')}
              className={`rounded-md px-2 py-1 ${audienceMode === 'phones' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}
            >
              Phone list
            </button>
            <button
              type="button"
              onClick={() => setAudienceMode('prospects')}
              className={`rounded-md px-2 py-1 ${audienceMode === 'prospects' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}
            >
              Prospects
            </button>
          </div>
          <input
            className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Campaign name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
          >
            {templates.map((t) => (
              <option key={t.name} value={t.name}>
                {t.label} ({t.name})
              </option>
            ))}
          </select>
          {audienceMode === 'phones' ? (
            <textarea
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              rows={8}
              placeholder="Phone numbers, one per line. Indian mobiles or E.164."
              value={phones}
              onChange={(e) => setPhones(e.target.value)}
            />
          ) : (
            <div className="mt-2 space-y-2">
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Project name (72 West)"
                aria-label="Project name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Wave"
                  aria-label="Wave"
                  value={wave}
                  onChange={(e) => setWave(e.target.value)}
                />
                <select
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  aria-label="Priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="">Any priority</option>
                  {['P1', 'P2', 'P3', 'P4', 'Intl'].map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Batch"
                aria-label="Batch"
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
              />
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Campaign tag"
                aria-label="Campaign tag"
                value={campaignTag}
                onChange={(e) => setCampaignTag(e.target.value)}
              />
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                aria-label="Template variables"
                value={variableMode}
                onChange={(e) => setVariableMode(e.target.value as 'both' | 'salutation')}
              >
                <option value="both">{'{{1}} salutation, {{2}} units'}</option>
                <option value="salutation">{'{{1}} salutation only'}</option>
              </select>
              <p className="text-xs text-slate-500">
                Opted-out owners are excluded. Each recipient gets salutation and unit values from their prospect.
              </p>
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={previewCampaign}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
            >
              Dry-run preview
            </button>
            <button
              type="button"
              onClick={createCampaign}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Create draft campaign
            </button>
          </div>
          {previewText ? (
            <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-xs text-slate-700">{previewText}</pre>
          ) : null}
          {message && <p className="mt-2 text-xs text-slate-600">{message}</p>}
          {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">Campaigns</h2>
          <ul className="space-y-2">
            {campaigns.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    selectedId === c.id ? 'border-slate-900 bg-slate-50' : 'border-slate-100'
                  }`}
                >
                  <p className="font-medium text-slate-900">{c.name}</p>
                  <p className="text-xs text-slate-500">
                    {c.templateName} · {c.status}
                    {c.deliveryStats
                      ? ` · D${c.deliveryStats.delivered}/R${c.deliveryStats.read}/F${c.deliveryStats.permanentFailure}`
                      : ''}
                  </p>
                </button>
              </li>
            ))}
            {!campaigns.length && <p className="text-sm text-slate-500">No campaigns yet.</p>}
          </ul>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        {!detail && <p className="text-sm text-slate-500">Select a campaign for delivery detail.</p>}
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{detail.campaign.name}</h2>
                <p className="text-sm text-slate-500">
                  {detail.campaign.status} · {detail.campaign.templateName}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(detail.campaign.status === 'draft'
                  || detail.campaign.status === 'scheduled'
                  || detail.campaign.status === 'running'
                  || detail.campaign.status === 'queued') && (
                  <button
                    type="button"
                    onClick={() => startCampaign(detail.campaign.id)}
                    className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Start / send batch
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => reconcile(detail.campaign.id)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs"
                >
                  Reconcile
                </button>
                {detail.campaign.status !== 'cancelled' && detail.campaign.status !== 'completed' && (
                  <button
                    type="button"
                    onClick={() => cancelCampaign(detail.campaign.id)}
                    className="rounded-md border border-rose-300 px-3 py-1.5 text-xs text-rose-700"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {stats && (
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:grid-cols-6">
                {[
                  ['Total', stats.total],
                  ['Queued', stats.queued],
                  ['Sent/pending', stats.sent + stats.submitted + stats.pending],
                  ['Delivered', stats.delivered],
                  ['Read', stats.read],
                  ['Retrying', stats.retryScheduled + stats.retrying],
                  ['Temp fail', stats.temporaryFailure],
                  ['Permanent', stats.permanentFailure],
                  ['Unknown', stats.unknown],
                  ['Cancelled', stats.cancelled],
                  ['Terminal', stats.terminal],
                  ['Open', stats.nonTerminal],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg bg-slate-50 px-2 py-2">
                    <p className="text-slate-500">{label}</p>
                    <p className="text-sm font-semibold">{value}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">Phone</th>
                    <th className="py-2 pr-3">Variables</th>
                    <th className="py-2 pr-3">State</th>
                    <th className="py-2 pr-3">Attempts</th>
                    <th className="py-2 pr-3">Failure</th>
                    <th className="py-2 pr-3">Provider ID</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.recipients.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100 align-top">
                      <td className="py-2 pr-3">
                        {r.name ? `${r.name} · ` : ''}****{r.normalizedPhone.slice(-4)}
                      </td>
                      <td className="py-2 pr-3 text-xs text-slate-600">{(r.bodyValues || []).join(' | ') || '—'}</td>
                      <td className="py-2 pr-3">
                        {r.deliveryState || r.status}
                        {r.reviewRequired ? ' · review' : ''}
                      </td>
                      <td className="py-2 pr-3">{r.attemptCount || 0}</td>
                      <td className="py-2 pr-3 text-xs text-slate-600">
                        {r.failureClass || '—'}
                        {r.failureReason ? ` · ${r.failureReason}` : ''}
                        {r.nextRetryAt ? ` · next ${r.nextRetryAt}` : ''}
                      </td>
                      <td className="py-2 pr-3 font-mono text-[11px]">
                        {r.providerMessageId || '—'}
                      </td>
                      <td className="py-2">
                        {(r.deliveryState === 'TEMPORARY_FAILURE'
                          || r.deliveryState === 'RETRY_SCHEDULED'
                          || r.deliveryState === 'PERMANENT_FAILURE'
                          || r.deliveryState === 'UNKNOWN') && (
                          <button
                            type="button"
                            onClick={() => retryRecipient(detail.campaign.id, r.id)}
                            className="text-xs font-medium text-emerald-700"
                          >
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
