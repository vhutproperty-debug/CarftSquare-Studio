'use client';

import { useCallback, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import type { OpsBrokerDirectory } from '@/lib/ops/brokers/types';

export default function BrokerDirectoryPanel() {
  const [items, setItems] = useState<OpsBrokerDirectory[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: '50' });
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`/api/ops/brokers/directory?${params}`, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setItems(data.items || []);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-3">
      <Input placeholder="Search brokers…" value={search} onChange={(e) => setSearch(e.target.value)} />
      {loading ? (
        <p className="text-sm text-slate-500">Loading directory…</p>
      ) : !items.length ? (
        <div className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-slate-500">
          No brokers yet. Import a WhatsApp export to populate the directory.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Broker</th>
                <th className="px-4 py-3 text-left">Phones</th>
                <th className="px-4 py-3 text-left">Groups</th>
                <th className="px-4 py-3 text-left">Inventory</th>
                <th className="px-4 py-3 text-left">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id} className="border-t border-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{b.canonicalName}</td>
                  <td className="px-4 py-3 text-slate-600">{b.phones.join(', ') || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{b.whatsappGroups.length}</td>
                  <td className="px-4 py-3 text-slate-600">{b.activeInventory}/{b.inventoryCount}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {b.lastSeenAt ? new Date(b.lastSeenAt).toLocaleDateString('en-IN') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
