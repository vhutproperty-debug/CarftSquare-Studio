'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Item = { source: string; sourceId: string; title: string; at: string };

const HREF: Record<string, string> = {
  requirement: '/ops/requirements',
  demand: '/ops/leads',
  whatsapp: '/ops/whatsapp',
};

export default function UnifiedInbox() {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/ops/inbox', { cache: 'no-store' })
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setError(data.error || 'Could not load the inbox.');
          return;
        }
        setItems(data.items || []);
      })
      .catch(() => setError('Could not load the inbox.'));
  }, []);

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Requirements, demand enquiries, and WhatsApp conversations in one list. Each row still belongs to its own record.</p>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={`${item.source}:${item.sourceId}`}>
            <Link href={HREF[item.source] || '/ops'} className="block rounded-md border border-slate-200 bg-white px-3 py-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{item.source}</p>
              <p className="font-semibold">{item.title}</p>
            </Link>
          </li>
        ))}
        {!items.length && !error ? <li className="text-sm text-slate-500">Nothing in the inbox yet.</li> : null}
      </ul>
    </div>
  );
}
