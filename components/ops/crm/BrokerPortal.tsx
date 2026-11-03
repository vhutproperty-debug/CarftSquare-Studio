'use client';

import { useEffect, useState } from 'react';

type Card = { id: string; projectName?: string; towerName?: string; rent?: string; status?: string; flat?: string };

export default function BrokerPortal() {
  const [apartments, setApartments] = useState<Card[]>([]);
  const [rentals, setRentals] = useState<Card[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/ops/broker-portal', { cache: 'no-store' })
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setError(data.error || 'Could not load the portal.');
          return;
        }
        setApartments(data.apartments || []);
        setRentals(data.rentals || []);
      })
      .catch(() => setError('Could not load the portal.'));
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Shared inventory only. Owner phones, flat numbers, negotiations, builder commercials, brokerage, and private client details are removed on the server.</p>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-bold">Apartments</h2>
        <ul className="mt-2 text-sm">
          {apartments.map((item) => <li key={item.id}>{item.projectName}{item.towerName ? ` · ${item.towerName}` : ''}</li>)}
          {!apartments.length ? <li className="text-slate-500">No shared apartments.</li> : null}
        </ul>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-bold">Rentals</h2>
        <ul className="mt-2 text-sm">
          {rentals.map((item) => <li key={item.id}>{item.status}{item.rent ? ` · ${item.rent}` : ''}</li>)}
          {!rentals.length ? <li className="text-slate-500">No shared rentals.</li> : null}
        </ul>
      </section>
    </div>
  );
}
