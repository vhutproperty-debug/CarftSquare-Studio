'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import OutcomeBar from '@/components/ops/contacts/OutcomeBar';
import PhoneLinks from '@/components/ops/contacts/PhoneLinks';
import type { Interaction, OpsTask } from '@/lib/ops/contacts/types';
import type { ContactView } from '@/lib/ops/contacts/view';

const inputClass = 'h-10 w-full rounded-md border border-slate-200 px-3 text-sm disabled:bg-slate-50';

export default function ContactDetail({ contactId }: { contactId: string }) {
  const [contact, setContact] = useState<ContactView | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [tasks, setTasks] = useState<OpsTask[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [note, setNote] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [flat, setFlat] = useState('');
  const [tower, setTower] = useState('');
  const [complex, setComplex] = useState('');
  const [agreementStart, setAgreementStart] = useState('');
  const [agreementEnd, setAgreementEnd] = useState('');

  const load = useCallback(async () => {
    const response = await fetch(`/api/ops/contacts/${contactId}`, { credentials: 'include' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || 'Unable to load the contact.');
      return;
    }
    const next = body.contact as ContactView;
    setContact(next);
    setInteractions(body.interactions || []);
    setTasks(body.tasks || []);
    setCanManage(Boolean(body.canManage));
    setName(next.name || '');
    setEmail(next.email || '');
    const unit = next.units[0];
    setFlat(unit?.flat || '');
    setTower(unit?.tower || '');
    setComplex(unit?.complex || next.complexes[0]?.complex || '');
    setAgreementStart(unit?.agreementStart || '');
    setAgreementEnd(unit?.agreementEnd || '');
    setError('');
  }, [contactId]);

  useEffect(() => { load(); }, [load]);

  async function saveDetails() {
    if (!contact) return;
    const patch: Record<string, unknown> = {};
    if (canManage || !contact.name) patch.name = name;
    if (canManage || !contact.email) patch.email = email;
    const unit = contact.units[0];
    if (unit) {
      patch.unit = {
        unitLinkId: unit.linkId,
        agreementStart: canManage || !unit.agreementStart ? agreementStart : undefined,
        agreementEnd: canManage || !unit.agreementEnd ? agreementEnd : undefined,
      };
    } else if (flat.trim()) {
      patch.unit = { complex, tower, flat, agreementStart, agreementEnd };
    } else if ((canManage || contact.complexes.length === 0) && complex.trim()) {
      patch.complex = complex;
    }
    const response = await fetch(`/api/ops/contacts/${contactId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || 'Unable to save.');
      return;
    }
    setNotice('Saved.');
    load();
  }

  async function saveNote() {
    const response = await fetch(`/api/ops/contacts/${contactId}/notes`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || 'Unable to save the note.');
      return;
    }
    setNote('');
    setNotice('Note added.');
    load();
  }

  async function remove() {
    if (!window.confirm('Delete this contact? Suspected brokers flagged VERIFY cannot be deleted.')) return;
    const response = await fetch(`/api/ops/contacts/${contactId}`, { method: 'DELETE', credentials: 'include' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || 'Unable to delete.');
      return;
    }
    window.location.href = '/ops/contacts';
  }

  if (!contact) {
    return error
      ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>
      : <p className="text-sm text-slate-500">Loading contact…</p>;
  }

  const unit = contact.units[0];
  const lock = (filled: boolean) => !canManage && filled;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{contact.roles.join(', ') || 'No role yet'}</p>
            <h2 className="text-2xl font-semibold text-slate-900">{contact.name || 'Unnamed contact'}</h2>
            <p className="mt-1"><PhoneLinks contactId={contact.id} phones={contact.phones} /></p>
          </div>
          <Link href="/ops/contacts" className="text-sm font-semibold text-orange-700">All contacts</Link>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          {contact.do_not_call ? <span className="rounded-full bg-rose-50 px-2 py-1 text-rose-800">Do not call</span> : null}
          {contact.opted_out ? <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">Opted out</span> : null}
          {contact.suspected_broker === 'VERIFY' ? <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-900">Suspected broker · VERIFY</span> : null}
          {contact.wrong_number ? <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-900">Wrong number</span> : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-500">Name
            <input className={`${inputClass} mt-1`} value={name} disabled={lock(Boolean(contact.name))} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="text-xs font-semibold text-slate-500">Email
            <input className={`${inputClass} mt-1`} value={email} disabled={lock(Boolean(contact.email))} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="text-xs font-semibold text-slate-500">Complex
            <input className={`${inputClass} mt-1`} value={complex} disabled={lock(contact.complexes.length > 0 || Boolean(unit))} onChange={(event) => setComplex(event.target.value)} />
          </label>
          <label className="text-xs font-semibold text-slate-500">Tower
            <input className={`${inputClass} mt-1`} value={tower} disabled={lock(Boolean(unit))} onChange={(event) => setTower(event.target.value)} />
          </label>
          <label className="text-xs font-semibold text-slate-500">Flat number
            <input className={`${inputClass} mt-1`} value={flat} disabled={lock(Boolean(unit?.flat))} onChange={(event) => setFlat(event.target.value)} />
          </label>
          <label className="text-xs font-semibold text-slate-500">Agreement start
            <input type="date" className={`${inputClass} mt-1`} value={agreementStart} disabled={lock(Boolean(unit?.agreementStart))} onChange={(event) => setAgreementStart(event.target.value)} />
          </label>
          <label className="text-xs font-semibold text-slate-500">Agreement end
            <input type="date" className={`${inputClass} mt-1`} value={agreementEnd} disabled={lock(Boolean(unit?.agreementEnd))} onChange={(event) => setAgreementEnd(event.target.value)} />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={saveDetails} className="min-h-10 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white">
            {canManage ? 'Save changes' : 'Save empty fields'}
          </button>
          {canManage ? <button type="button" onClick={remove} className="min-h-10 rounded-md border border-rose-300 px-3 text-sm font-semibold text-rose-700">Delete</button> : null}
        </div>
        {contact.units.length > 1 ? (
          <ul className="space-y-1 text-sm text-slate-700">
            {contact.units.slice(1).map((item) => (
              <li key={item.linkId}>{item.complex} · {item.tower || 'no tower'} · flat {item.flat} · {item.relation}{item.agreementEnd ? ` · ends ${item.agreementEnd}` : ''}</li>
            ))}
          </ul>
        ) : null}
        <div>
          <h3 className="text-sm font-bold text-slate-900">Call outcome</h3>
          <div className="mt-2"><OutcomeBar contactId={contact.id} onDone={load} /></div>
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">Add a remark</h3>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} aria-label="Remark" className="mt-2 min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
          <button type="button" onClick={saveNote} className="mt-2 min-h-10 rounded-md border border-slate-300 px-3 text-sm font-semibold">Add remark</button>
        </div>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900">Timeline</h3>
        {tasks.filter((task) => task.status === 'open').length ? (
          <ul className="mt-3 space-y-1 text-sm text-slate-700">
            {tasks.filter((task) => task.status === 'open').map((task) => (
              <li key={task.id}>{task.type} · {task.dueAt}{task.note ? ` · ${task.note}` : ''}</li>
            ))}
          </ul>
        ) : null}
        <ol className="mt-4 space-y-3">
          {interactions.map((item) => (
            <li key={item.id} className="border-l-2 border-slate-200 pl-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.kind}{item.outcome ? ` · ${item.outcome}` : ''} · {new Date(item.createdAt).toLocaleString()}</p>
              <p className="text-sm text-slate-800">{item.note || '—'}</p>
              <p className="text-xs text-slate-500">{item.actorName || item.actorEmail}</p>
              {item.changes?.length ? (
                <ul className="mt-1 text-xs text-slate-600">
                  {item.changes.map((change, index) => (
                    <li key={`${item.id}-${index}`}>{change.field}: {change.from || 'empty'} → {change.to || 'empty'}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
        {interactions.length === 0 ? <p className="mt-4 text-sm text-slate-500">No calls or notes yet.</p> : null}
      </section>
    </div>
  );
}
