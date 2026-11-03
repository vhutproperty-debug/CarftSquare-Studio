'use client';

import { useCallback, useEffect, useState } from 'react';

type Review = {
  id: string;
  phone: string;
  contactIds: string[];
  status: 'open' | 'resolved';
  decision: string;
};

export default function DuplicateReviewQueue() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const response = await fetch('/api/ops/contacts/duplicates', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Could not load the duplicate queue.');
      return;
    }
    setReviews(data.reviews || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function scan() {
    setError('');
    const response = await fetch('/api/ops/contacts/duplicates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'scan' }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Scan failed.');
      return;
    }
    setMessage(`Queued ${data.created} new review${data.created === 1 ? '' : 's'}. Nothing was merged.`);
    await load();
  }

  async function resolve(id: string, decision: 'keep_both' | 'dismiss') {
    setError('');
    const response = await fetch('/api/ops/contacts/duplicates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resolve', id, decision }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Could not update the review.');
      return;
    }
    setMessage(decision === 'keep_both' ? 'Both contacts stay in the directory.' : 'Review dismissed. Contacts were not deleted.');
    await load();
  }

  const open = reviews.filter((review) => review.status === 'open');

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">Duplicate review</h2>
          <p className="text-sm text-slate-600">Shared phone numbers wait here. Keep both or dismiss. Records are never merged or deleted.</p>
        </div>
        <button type="button" onClick={scan} className="rounded-md bg-orange-600 px-3 py-2 text-sm font-semibold text-white">
          Find duplicates
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
      <ul className="mt-4 space-y-2">
        {open.map((review) => (
          <li key={review.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2">
            <div>
              <p className="font-semibold">{review.phone}</p>
              <p className="text-xs text-slate-500">{review.contactIds.join(', ')}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="rounded-md border border-slate-300 px-2 py-1 text-sm" onClick={() => resolve(review.id, 'keep_both')}>Keep both</button>
              <button type="button" className="rounded-md border border-slate-300 px-2 py-1 text-sm" onClick={() => resolve(review.id, 'dismiss')}>Dismiss</button>
            </div>
          </li>
        ))}
        {!open.length ? <li className="text-sm text-slate-500">No open duplicate reviews.</li> : null}
      </ul>
    </section>
  );
}
