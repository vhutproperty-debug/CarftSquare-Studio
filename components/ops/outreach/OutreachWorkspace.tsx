'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { buildWhatsAppLink } from '@/lib/ops/phone';
import { outreachMessage } from '@/lib/ops/outreach/template';
import {
  OUTREACH_AUDIENCE_LABELS,
  OUTREACH_AUDIENCES,
  OUTREACH_STATUS_LABELS,
  OUTREACH_STATUSES,
  type OutreachAudience,
  type OutreachContact,
  type OutreachStatus,
  type OutreachTemplate,
} from '@/lib/ops/outreach/types';

type Payload = {
  items: OutreachContact[];
  counts: Record<OutreachStatus, number>;
  options: { waves: string[]; projects: string[]; towers: string[] };
  templates: OutreachTemplate[];
  canManage: boolean;
  error?: string;
};

const selectClass = 'h-9 rounded-md border border-slate-200 bg-white px-2 text-sm';

export default function OutreachWorkspace() {
  const [audience, setAudience] = useState<OutreachAudience>('owner_sell');
  const [wave, setWave] = useState('');
  const [project, setProject] = useState('');
  const [tower, setTower] = useState('');
  const [status, setStatus] = useState('');
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [templateBody, setTemplateBody] = useState('');
  const [editingTemplate, setEditingTemplate] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ audience });
    if (wave) params.set('wave', wave);
    if (project) params.set('project', project);
    if (tower) params.set('tower', tower);
    if (status) params.set('status', status);
    const response = await fetch(`/api/ops/outreach?${params}`, { credentials: 'include' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || 'Unable to load outreach.');
      return;
    }
    setData(body);
    const current = (body.templates || []).find((item: OutreachTemplate) => item.audience === audience);
    setTemplateBody(current?.body || 'Hi {first_name}, this is CraftSquare about {project} {tower}.');
    setError('');
  }, [audience, project, status, tower, wave]);

  useEffect(() => { load(); }, [load]);

  async function patch(contact: OutreachContact, change: Record<string, unknown>) {
    const response = await fetch('/api/ops/outreach', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...contact, flats: contact.flats, ...change }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || 'Unable to update the contact.');
      return;
    }
    await load();
  }

  const template = data?.templates?.find((item) => item.audience === audience)?.body || templateBody;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        The team sends every WhatsApp message by hand. Nothing on this screen sends automatically. Names and phones stay inside ops.
      </p>
      <div className="flex flex-wrap gap-1 rounded-lg bg-slate-200/70 p-1">
        {OUTREACH_AUDIENCES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setAudience(item)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${audience === item ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
          >
            {OUTREACH_AUDIENCE_LABELS[item]}
          </button>
        ))}
      </div>
      {data ? (
        <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {OUTREACH_STATUSES.map((item) => (
            <button key={item} type="button" onClick={() => setStatus(status === item ? '' : item)} className={`rounded-xl border bg-white px-3 py-2 text-left shadow-sm ${status === item ? 'border-orange-300' : 'border-slate-200'}`}>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{OUTREACH_STATUS_LABELS[item]}</p>
              <p className="text-xl font-semibold text-slate-900">{data.counts[item] || 0}</p>
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <select className={selectClass} aria-label="Filter by wave" value={wave} onChange={(event) => setWave(event.target.value)}>
          <option value="">All waves</option>
          {(data?.options.waves || []).map((item) => <option key={item}>{item}</option>)}
        </select>
        <select className={selectClass} aria-label="Filter by project" value={project} onChange={(event) => setProject(event.target.value)}>
          <option value="">All projects</option>
          {(data?.options.projects || []).map((item) => <option key={item}>{item}</option>)}
        </select>
        <select className={selectClass} aria-label="Filter by tower" value={tower} onChange={(event) => setTower(event.target.value)}>
          <option value="">All towers</option>
          {(data?.options.towers || []).map((item) => <option key={item}>{item}</option>)}
        </select>
        {data?.canManage ? (
          <>
            <Button type="button" size="sm" variant="outline" asChild>
              <a href={`/api/ops/outreach/export?audience=${audience}&wave=${encodeURIComponent(wave)}`}>Export CSV</a>
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!wave}
              onClick={async () => {
                const response = await fetch(`/api/ops/outreach?action=approve`, {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ wave, audience, note: 'Wave approved. No messages were sent.' }),
                });
                const body = await response.json().catch(() => ({}));
                if (!response.ok) setError(body.error || 'Unable to record approval.');
                else setNotice(`Approval logged for wave ${wave}. No messages were sent.`);
              }}
            >
              Mark wave approved
            </Button>
          </>
        ) : null}
      </div>
      {data?.canManage ? (
        <form
          className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const file = new FormData(form).get('file');
            if (!(file instanceof File)) return;
            const body = new FormData();
            body.set('file', file);
            const response = await fetch('/api/ops/outreach/import', { method: 'POST', body, credentials: 'include' });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) setError(payload.error || 'Import failed.');
            else {
              setNotice(`Upserted ${payload.created} new and ${payload.updated} existing contacts.`);
              form.reset();
              await load();
            }
          }}
        >
          <p className="text-sm text-slate-700">CSV upsert by phone + audience.</p>
          <input name="file" type="file" accept=".csv,text/csv" aria-label="Outreach CSV" className="text-sm" />
          <Button type="submit" size="sm">Upload</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setEditingTemplate((open) => !open)}>Templates</Button>
        </form>
      ) : null}
      {editingTemplate && data?.canManage ? (
        <form
          className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          onSubmit={async (event) => {
            event.preventDefault();
            const response = await fetch('/api/ops/outreach/templates', {
              method: 'PUT',
              credentials: 'include',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ audience, body: templateBody }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) setError(payload.error || 'Unable to save the template.');
            else setNotice('Template saved. Placeholders: {first_name}, {project}, {tower}.');
          }}
        >
          <p className="text-sm font-medium text-slate-900">Template for {OUTREACH_AUDIENCE_LABELS[audience]}</p>
          <Textarea value={templateBody} onChange={(event) => setTemplateBody(event.target.value)} aria-label="Message template" />
          <Button type="submit" size="sm">Save template</Button>
        </form>
      ) : null}
      {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}
      {notice ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</p> : null}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">Contact</th>
                <th className="px-3 py-3">Project</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Notes</th>
                <th className="px-3 py-3">WhatsApp</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items || []).map((contact) => {
                const link = buildWhatsAppLink(contact.phone_e164, outreachMessage(contact, template));
                return (
                  <tr key={contact.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-900">{contact.name}</p>
                      <p className="text-slate-600">{contact.phone_e164}</p>
                      <p className="text-xs text-slate-500">{contact.role} · {contact.wave || 'No wave'} · {contact.priority || 'No priority'}</p>
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {contact.project || '—'}
                      <span className="mt-1 block text-xs text-slate-500">{[contact.tower && `Tower ${contact.tower}`, contact.floor && `Floor ${contact.floor}`, contact.bhk && `${contact.bhk} BHK`].filter(Boolean).join(' · ')}</span>
                      {contact.flats.length ? <span className="mt-1 block text-xs text-slate-500">{contact.flats.join(', ')}</span> : null}
                    </td>
                    <td className="px-3 py-3">
                      <select
                        className={selectClass}
                        aria-label={`Status for ${contact.name}`}
                        value={contact.status}
                        disabled={!data?.canManage}
                        onChange={(event) => patch(contact, { status: event.target.value })}
                      >
                        {OUTREACH_STATUSES.map((item) => <option key={item} value={item}>{OUTREACH_STATUS_LABELS[item]}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <Input
                        defaultValue={contact.notes}
                        aria-label={`Notes for ${contact.name}`}
                        disabled={!data?.canManage}
                        onBlur={(event) => {
                          if (event.target.value !== contact.notes) patch(contact, { notes: event.target.value, note: event.target.value });
                        }}
                      />
                    </td>
                    <td className="px-3 py-3">
                      {link && contact.status !== 'do_not_contact' ? (
                        <a className="inline-flex h-8 items-center rounded-md bg-emerald-600 px-3 text-xs font-medium text-white" href={link} target="_blank" rel="noreferrer">Open WhatsApp</a>
                      ) : <span className="text-xs text-slate-400">No send</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {data && data.items.length === 0 ? <p className="px-4 py-8 text-center text-sm text-slate-500">No contacts in this view.</p> : null}
      </div>
    </div>
  );
}
