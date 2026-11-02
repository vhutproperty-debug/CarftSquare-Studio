'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import PhoneLinks from '@/components/ops/contacts/PhoneLinks';
import type { ContactView } from '@/lib/ops/contacts/view';

const fieldClass = 'h-10 rounded-md border border-slate-200 bg-white px-3 text-sm';

function flags(contact: ContactView) {
  const items = [
    contact.do_not_call ? 'Do not call' : '',
    contact.opted_out ? 'Opted out' : '',
    contact.suspected_broker === 'VERIFY' ? 'Suspected broker' : '',
    contact.wrong_number ? 'Wrong number' : '',
  ].filter(Boolean);
  return items;
}

export default function ContactsWorkspace() {
  const [q, setQ] = useState('');
  const [complex, setComplex] = useState('');
  const [items, setItems] = useState<ContactView[]>([]);
  const [complexes, setComplexes] = useState<string[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (complex) params.set('complex', complex);
    const response = await fetch(`/api/ops/contacts?${params}`, { credentials: 'include' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || 'Unable to load contacts.');
      return;
    }
    setItems(body.items || []);
    setComplexes(body.complexes || []);
    setCanManage(Boolean(body.canManage));
    setError('');
  }, [complex, q]);

  useEffect(() => {
    const timer = setTimeout(() => { load(); }, 200);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${fieldClass} min-w-56`} aria-label="Search contacts" placeholder="Search name or phone" value={q} onChange={(event) => setQ(event.target.value)} />
        <select className={fieldClass} aria-label="Complex" value={complex} onChange={(event) => setComplex(event.target.value)}>
          <option value="">All complexes</option>
          {complexes.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <Link href="/ops/contacts/queue" className="inline-flex h-10 items-center rounded-md bg-slate-900 px-3 text-sm font-semibold text-white">Cold calls</Link>
        {canManage ? (
          <>
            <Link href="/ops/contacts/import" className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800">Import</Link>
            <a href="/api/ops/contacts/export" className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800">Export</a>
          </>
        ) : null}
      </div>
      <p className="text-sm text-slate-600">
        Team members can view every phone and flat number, add notes and call outcomes, and fill blanks. Import, export, and changes to existing details are limited to super admins.
      </p>
      {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Complex / flat</th>
              <th className="px-4 py-3">Flags</th>
            </tr>
          </thead>
          <tbody>
            {items.map((contact) => (
              <tr key={contact.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/ops/contacts/${contact.id}`} className="font-semibold text-slate-900 hover:text-orange-700">{contact.name || 'Unnamed'}</Link>
                </td>
                <td className="px-4 py-3"><PhoneLinks contactId={contact.id} phones={contact.phones} /></td>
                <td className="px-4 py-3 text-slate-700">{contact.roles.join(', ') || '—'}</td>
                <td className="px-4 py-3 text-slate-700">
                  {contact.units.length
                    ? contact.units.map((unit) => `${unit.complex} ${unit.tower} ${unit.flat}`.trim()).join(' · ')
                    : contact.complexes.map((item) => item.complex).join(', ') || '—'}
                </td>
                <td className="px-4 py-3 text-xs font-semibold text-slate-600">{flags(contact).join(' · ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-500">No contacts match this search.</p> : null}
      </div>
    </div>
  );
}
