'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUSES = [
  { id: 'pending', label: 'Pending' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'closed', label: 'Closed' },
];

function statusLabel(status) {
  return STATUSES.find((s) => s.id === status)?.label || status;
}

export default function PartnerCallbackRequestsPanel({ canEdit }) {
  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (statusFilter) params.set('status', statusFilter);

    const res = await fetch(`/api/admin/partner-network/callback-requests?${params}`, { credentials: 'include' });
    const data = await res.json();
    if (res.ok) setRequests(data.requests || []);
  }, [search, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(id, status) {
    setUpdatingId(id);
    try {
      await fetch('/api/admin/partner-network/callback-requests', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      load();
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
        <Input
          placeholder="Search name, mobile..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md bg-white/10 text-white"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-md border border-white/20 bg-white/10 px-3 text-sm text-white"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {requests.map((row) => (
          <Card key={row.id} className="border-white/10 bg-white/5">
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-white">{row.name || 'No name'}</p>
                  <Badge variant="outline" className="border-white/20 capitalize text-slate-200">
                    {statusLabel(row.status)}
                  </Badge>
                </div>
                <p className="text-sm text-slate-300">
                  <a href={`tel:${row.mobile}`} className="font-medium text-white hover:text-orange-300">{row.mobile}</a>
                </p>
                <p className="text-xs text-slate-400">
                  {row.source} · {row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}
                </p>
              </div>
              {canEdit && (
                <Select
                  value={row.status}
                  disabled={updatingId === row.id}
                  onValueChange={(v) => updateStatus(row.id, v)}
                >
                  <SelectTrigger className="w-40 bg-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>
        ))}
        {!requests.length && <p className="text-slate-400">No partner callback requests yet.</p>}
      </div>
    </div>
  );
}
