'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AdminBadge, StatusBadge } from '@/components/ops/broker-crm/badges';
import BrokerCrmTabs from '@/components/ops/broker-crm/BrokerCrmTabs';
import { formatBrokerPhone, mumbaiToday } from '@/lib/ops/broker-crm/format';
import { applyBrokerCrmPatch } from '@/lib/ops/broker-crm/patch';
import type { OpsBrokerCrmRecord } from '@/lib/ops/broker-crm/types';
import {
  buildWaveMessageTemplate,
  buildWhatsAppPriorityQueue,
  renderWaveCsv,
  WAVE_DESCRIPTIONS,
  WAVE_FLOOR_BANDS,
  WAVE_LABELS,
  type WaveApproval,
  type WaveId,
  type WaveMessageTemplate,
} from '@/lib/ops/broker-crm/waves';

const FURNISHING_OPTIONS = ['Furnishing on request', 'Furnished', 'Semi-furnished', 'Unfurnished'];
const BHK_OPTIONS = ['', '1 BHK', '2 BHK', '3 BHK', '4 BHK'];

type QueuePayload = ReturnType<typeof buildWhatsAppPriorityQueue> & { approvals?: WaveApproval[] };

export default function BrokerCrmQueue({
  initialRecords,
  detailBase = '/ops/broker-crm',
  tabsBase = '/ops/broker-crm',
}: {
  initialRecords?: OpsBrokerCrmRecord[];
  detailBase?: string;
  tabsBase?: string;
}) {
  const preview = Boolean(initialRecords);
  const [records, setRecords] = useState<OpsBrokerCrmRecord[]>(initialRecords || []);
  const [remote, setRemote] = useState<QueuePayload | null>(null);
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [wave, setWave] = useState<WaveId>(1);
  const [search, setSearch] = useState('');
  const [bhk, setBhk] = useState('2 BHK');
  const [floorBand, setFloorBand] = useState<string>(WAVE_FLOOR_BANDS[0]);
  const [furnishing, setFurnishing] = useState(FURNISHING_OPTIONS[0]);
  const [project, setProject] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewApprovals, setPreviewApprovals] = useState<WaveApproval[]>([]);

  useEffect(() => {
    if (preview) return;
    let cancelled = false;
    fetch('/api/ops/broker-crm/queue', { credentials: 'include' })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) {
          setError(body.error || 'Unable to load the priority queue.');
          return;
        }
        setRemote(body);
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load the priority queue.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [preview]);

  const localQueue = useMemo(() => (preview ? buildWhatsAppPriorityQueue(records) : null), [preview, records]);
  const queue = preview ? localQueue : remote;
  const templateResult = useMemo(() => {
    try {
      return { template: buildWaveMessageTemplate({ bhk, floorBand, furnishing, project }), error: '' };
    } catch (caught) {
      return { template: null as WaveMessageTemplate | null, error: caught instanceof Error ? caught.message : 'This template is not allowed.' };
    }
  }, [bhk, floorBand, furnishing, project]);

  const rows = (queue?.waves[wave] || []).filter((row) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return `${row.name} ${row.phone} ${row.groups.join(' ')}`.toLowerCase().includes(query);
  });

  function templateQuery(): string {
    const params = new URLSearchParams({
      wave: String(wave),
      template: '1',
      bhk,
      floorBand,
      furnishing,
      project,
    });
    return params.toString();
  }

  function downloadPreviewCsv() {
    if (!templateResult.template || !queue) return;
    const csv = renderWaveCsv(queue.waves[wave], { bhk, floorBand, furnishing, project });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `broker-crm-wave-${wave}-sample.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice(`Exported wave ${wave}. Do-not-contact brokers are not in the file. Nothing was sent.`);
  }

  async function approve() {
    if (!templateResult.template) {
      setError(templateResult.error || 'Fix the template before approving.');
      return;
    }
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (preview) {
        const approval: WaveApproval = {
          id: `preview-${wave}`,
          wave,
          approvedAt: new Date().toISOString(),
          approvedById: 'preview',
          approvedByEmail: 'owner@example.com',
          recipientCount: queue?.counts[wave] || 0,
          template: templateResult.template.text,
          sent: false,
        };
        setNotice(`Wave ${wave} approved in this preview and logged locally. No WhatsApp message was sent.`);
        setPreviewApprovals((current) => [approval, ...current.filter((item) => item.wave !== wave)]);
        setConfirming(false);
        return;
      }
      const response = await fetch('/api/ops/broker-crm/queue/approve', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wave, template: { bhk, floorBand, furnishing, project } }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error || 'Unable to approve this wave.');
        return;
      }
      setNotice(body.message || 'Wave approved and logged. No WhatsApp message was sent.');
      setRemote((current) => current ? { ...current, approvals: [body.approval, ...(current.approvals || [])] } : current);
      setConfirming(false);
    } catch {
      setError('Unable to approve this wave.');
    } finally {
      setBusy(false);
    }
  }

  const approvals = (preview ? previewApprovals : remote?.approvals || []).filter((item) => item.wave === wave);

  async function markContacted(id: string) {
    setError('');
    if (preview) {
      setRecords((current) => current.map((record) => {
        if (record.id !== id) return record;
        const status = record.status === 'active' ? 'active' : 'contacted';
        return applyBrokerCrmPatch(record, { status, lastContactedAt: mumbaiToday() }, new Date().toISOString());
      }));
      setNotice('Marked contacted in this preview. Nothing was sent.');
      return;
    }
    const response = await fetch('/api/ops/broker-crm/queue/contacted', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || 'Unable to mark this broker contacted.');
      return;
    }
    setRemote((current) => {
      if (!current) return current;
      const nextWaves = { ...current.waves };
      for (const key of [1, 2, 3] as WaveId[]) {
        nextWaves[key] = current.waves[key].map((row) => row.id === id
          ? { ...row, status: body.broker.status, lastContactedAt: body.broker.lastContactedAt }
          : row);
      }
      return { ...current, waves: nextWaves };
    });
    setNotice('Marked contacted. Nothing was sent.');
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BrokerCrmTabs current="queue" base={tabsBase} />
      </div>
      {preview ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Sample queue. Invented brokers only. Approving a wave logs the choice and can export a CSV. It does not send WhatsApp.
        </div>
      ) : null}
      <p className="text-sm text-slate-600">
        Brokers in two or more groups, with do-not-contact left out. Wave 1 is four or more groups, highest count first, admins first on a tie. Wave 2 is three groups. Wave 3 is two groups.
        {queue ? ` ${queue.excludedDoNotContact} do-not-contact broker${queue.excludedDoNotContact === 1 ? '' : 's'} in these counts are excluded.` : ''}
      </p>

      {queue ? (
        <div className="grid gap-2 sm:grid-cols-3">
          {([1, 2, 3] as WaveId[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => { setWave(id); setConfirming(false); }}
              className={`rounded-xl border px-4 py-3 text-left shadow-sm ${wave === id ? 'border-slate-900 bg-white' : 'border-slate-200 bg-white'}`}
            >
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{WAVE_LABELS[id]}</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{queue.counts[id]}</p>
              <p className="mt-1 text-xs text-slate-500">{WAVE_DESCRIPTIONS[id]}</p>
            </button>
          ))}
        </div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Message template</h2>
        <p className="mt-1 text-sm text-slate-600">
          The message may contain only BHK, a floor band, furnishing, the project, and “Call for price”. Prices, unit numbers, owner details, and commercial terms cannot be entered.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <select aria-label="Template BHK" value={bhk} onChange={(event) => setBhk(event.target.value)} className="h-9 rounded-md border border-slate-200 px-2 text-sm">
            {BHK_OPTIONS.map((option) => <option key={option || 'open'} value={option}>{option || 'BHK on request'}</option>)}
          </select>
          <select aria-label="Floor band" value={floorBand} onChange={(event) => setFloorBand(event.target.value)} className="h-9 rounded-md border border-slate-200 px-2 text-sm">
            {WAVE_FLOOR_BANDS.map((option) => <option key={option}>{option}</option>)}
          </select>
          <select aria-label="Furnishing" value={furnishing} onChange={(event) => setFurnishing(event.target.value)} className="h-9 rounded-md border border-slate-200 px-2 text-sm">
            {FURNISHING_OPTIONS.map((option) => <option key={option}>{option}</option>)}
          </select>
          <Input aria-label="Project" value={project} onChange={(event) => setProject(event.target.value)} placeholder="Project" />
        </div>
        {templateResult.template ? (
          <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-800">{templateResult.template.text}</pre>
        ) : (
          <p className="mt-3 text-sm text-rose-800">{templateResult.error}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {preview ? (
            <Button type="button" variant="outline" size="sm" onClick={downloadPreviewCsv} disabled={!templateResult.template}>
              <Download className="h-4 w-4" />
              Export wave CSV
            </Button>
          ) : templateResult.template ? (
            <Button type="button" variant="outline" size="sm" asChild>
              <a href={`/api/ops/broker-crm/queue/export?${templateQuery()}`}>
                <Download className="h-4 w-4" />
                Export wave CSV
              </a>
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" disabled>
              <Download className="h-4 w-4" />
              Export wave CSV
            </Button>
          )}
          <Button type="button" size="sm" onClick={approve} disabled={busy || !templateResult.template}>
            {confirming ? 'Confirm approval — this does not send WhatsApp' : `Approve ${WAVE_LABELS[wave]}`}
          </Button>
          {confirming ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
          ) : null}
        </div>
        {approvals[0] ? (
          <p className="mt-3 text-sm text-slate-600">
            Last approval {approvals[0].approvedAt.slice(0, 16).replace('T', ' ')} · {approvals[0].recipientCount} brokers · nothing sent.
          </p>
        ) : (
          <p className="mt-3 text-sm text-slate-500">This wave is not approved yet. Approval only writes a log, or you can export the list.</p>
        )}
      </section>

      <Input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search this wave" placeholder="Search name, phone, or group" className="lg:max-w-sm" />
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}
      {notice ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</div> : null}
      {loading ? <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">Loading the queue…</div> : null}

      {queue && rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">No brokers in this wave.</div>
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Broker</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Groups</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last contacted</th>
                  <th className="px-4 py-3"> </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <Link href={`${detailBase}/${row.id}`} className="font-medium text-slate-900 underline-offset-2 hover:underline">{row.name}</Link>
                      {row.admin ? <div className="mt-1"><AdminBadge /></div> : null}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{formatBrokerPhone(row.phone)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <span className="font-semibold text-slate-900">{row.groupCount}</span>
                      <span className="mt-1 block max-w-sm text-xs text-slate-500">{row.groups.join(' · ')}</span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                    <td className="px-4 py-3 text-slate-600">{row.lastContactedAt || '—'}</td>
                    <td className="px-4 py-3">
                      <Button type="button" variant="outline" size="sm" onClick={() => markContacted(row.id)}>Mark contacted</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
