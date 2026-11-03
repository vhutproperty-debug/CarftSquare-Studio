'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';

type Terms = {
  id: string;
  agreementId: string;
  rent: string;
  deposit: string;
  lockInMonths: number | null;
  noticeDays: number | null;
};

export default function AgreementTermsPanel() {
  const [terms, setTerms] = useState<Terms[]>([]);
  const [agreementId, setAgreementId] = useState('');
  const [rent, setRent] = useState('');
  const [deposit, setDeposit] = useState('');
  const [lockInMonths, setLockInMonths] = useState('');
  const [noticeDays, setNoticeDays] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [hidden, setHidden] = useState(true);

  const load = useCallback(async () => {
    const response = await fetch('/api/ops/agreements/terms', { cache: 'no-store' });
    if (response.status === 404) {
      setHidden(true);
      return;
    }
    const data = await response.json();
    if (!response.ok) {
      setHidden(false);
      setError(data.error || 'Could not load agreement terms.');
      return;
    }
    setHidden(false);
    setTerms(data.terms || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    const response = await fetch('/api/ops/agreements/terms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agreementId,
        rent,
        deposit,
        lockInMonths: lockInMonths === '' ? null : Number(lockInMonths),
        noticeDays: noticeDays === '' ? null : Number(noticeDays),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Could not save terms.');
      return;
    }
    setMessage('Terms saved on a separate record. The agreement itself was not overwritten.');
    setAgreementId('');
    setRent('');
    setDeposit('');
    setLockInMonths('');
    setNoticeDays('');
    await load();
  }

  if (hidden) return null;

  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-base font-bold">Rent, deposit, lock-in, notice</h2>
      <p className="text-sm text-slate-600">Stored beside the agreement. Existing agreement rows are left as they are.</p>
      <form onSubmit={onSubmit} className="mt-3 grid gap-3 md:grid-cols-5">
        <input aria-label="Agreement id" value={agreementId} onChange={(event) => setAgreementId(event.target.value)} required placeholder="Agreement id" className="h-10 rounded-md border border-slate-200 px-3" />
        <input aria-label="Rent" value={rent} onChange={(event) => setRent(event.target.value)} placeholder="Rent" className="h-10 rounded-md border border-slate-200 px-3" />
        <input aria-label="Deposit" value={deposit} onChange={(event) => setDeposit(event.target.value)} placeholder="Deposit" className="h-10 rounded-md border border-slate-200 px-3" />
        <input aria-label="Lock-in months" value={lockInMonths} onChange={(event) => setLockInMonths(event.target.value)} placeholder="Lock-in months" inputMode="numeric" className="h-10 rounded-md border border-slate-200 px-3" />
        <input aria-label="Notice days" value={noticeDays} onChange={(event) => setNoticeDays(event.target.value)} placeholder="Notice days" inputMode="numeric" className="h-10 rounded-md border border-slate-200 px-3" />
        <button type="submit" className="h-10 rounded-md bg-orange-600 px-3 text-sm font-semibold text-white md:col-span-5 md:w-fit">Save terms</button>
      </form>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
      <ul className="mt-4 space-y-2">
        {terms.map((item) => (
          <li key={item.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
            <span className="font-semibold">{item.agreementId}</span>
            {' · rent '}{item.rent || '—'}
            {' · deposit '}{item.deposit || '—'}
            {' · lock-in '}{item.lockInMonths ?? '—'}{' mo'}
            {' · notice '}{item.noticeDays ?? '—'}{' days'}
          </li>
        ))}
      </ul>
    </section>
  );
}
