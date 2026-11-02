'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import OutcomeBar from '@/components/ops/contacts/OutcomeBar';
import PhoneLinks from '@/components/ops/contacts/PhoneLinks';
import type { ContactView } from '@/lib/ops/contacts/view';

type CallbackItem = {
  id: string;
  contactId: string;
  contactName: string;
  phones: string[];
  dueAt: string;
  note: string;
};

type Member = { id: string; name: string; email: string };

const selectClass = 'h-10 rounded-md border border-slate-200 bg-white px-2 text-sm';

function bandLabel(band: number) {
  if (band === 0) return 'Multi-unit owner';
  if (band === 1) return 'Agreement expiring';
  if (band === 2) return 'Not contacted';
  return 'Later';
}

export default function ColdCallWorkspace() {
  const [complex, setComplex] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [items, setItems] = useState<ContactView[]>([]);
  const [callbacks, setCallbacks] = useState<CallbackItem[]>([]);
  const [complexes, setComplexes] = useState<string[]>([]);
  const [team, setTeam] = useState<Member[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (complex) params.set('complex', complex);
    if (assignedTo) params.set('assignedTo', assignedTo);
    const response = await fetch(`/api/ops/contacts/queue?${params}`, { credentials: 'include' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || 'Unable to load the queue.');
      return;
    }
    setItems(body.items || []);
    setCallbacks(body.callbacks || []);
    setComplexes(body.complexes || []);
    setError('');
  }, [assignedTo, complex]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch('/api/ops/team', { credentials: 'include' })
      .then((response) => response.json())
      .then((body) => setTeam(body.members || []))
      .catch(() => setTeam([]));
  }, []);

  async function assign(contactId: string, assigneeId: string) {
    await fetch(`/api/ops/contacts/${contactId}/assign`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigneeId }),
    });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select className={selectClass} aria-label="Complex" value={complex} onChange={(event) => setComplex(event.target.value)}>
          <option value="">All complexes</option>
          {complexes.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select className={selectClass} aria-label="Assignee" value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
          <option value="">Anyone</option>
          <option value="unassigned">Unassigned</option>
          {team.map((member) => <option key={member.id} value={member.id}>{member.name || member.email}</option>)}
        </select>
      </div>
      {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}
      {callbacks.length ? (
        <section className="rounded-xl border border-sky-200 bg-sky-50 p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-sky-900">Callbacks due</h2>
          <ul className="mt-2 space-y-2">
            {callbacks.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <Link href={`/ops/contacts/${item.contactId}`} className="font-semibold text-slate-900">{item.contactName || 'Unnamed'}</Link>
                <PhoneLinks contactId={item.contactId} phones={item.phones} />
                <span className="text-slate-600">{item.dueAt}{item.note ? ` · ${item.note}` : ''}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className="grid gap-3">
        {items.map((contact) => (
          <article key={contact.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/ops/contacts/${contact.id}`} className="text-lg font-semibold text-slate-900">{contact.name || 'Unnamed'}</Link>
                  <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-bold text-orange-800">{bandLabel(contact.queueBand)}</span>
                </div>
                <p className="mt-1"><PhoneLinks contactId={contact.id} phones={contact.phones} /></p>
                <p className="mt-1 text-sm text-slate-600">
                  {contact.units.length
                    ? contact.units.map((unit) => `${unit.complex} · ${unit.tower || 'no tower'} · flat ${unit.flat}${unit.agreementEnd ? ` · ends ${unit.agreementEnd}` : ''}`).join(' | ')
                    : contact.complexes.map((item) => item.complex).join(', ') || 'No complex yet'}
                  {contact.ownerUnitCount >= 2 ? ` · ${contact.ownerUnitCount} owner units` : ''}
                </p>
              </div>
              <label className="text-xs font-semibold text-slate-500">
                Assign
                <select className={`${selectClass} mt-1 block`} aria-label={`Assign ${contact.name || 'contact'}`} value={contact.assignedTo} onChange={(event) => assign(contact.id, event.target.value)}>
                  <option value="">Unassigned</option>
                  {team.map((member) => <option key={member.id} value={member.id}>{member.name || member.email}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-3">
              <OutcomeBar contactId={contact.id} onDone={load} />
            </div>
          </article>
        ))}
      </div>
      {items.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">Nobody is waiting in this queue.</p> : null}
    </div>
  );
}
