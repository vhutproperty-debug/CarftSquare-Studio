'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { PaintingLead, PaintingLeadStatus } from '@/lib/painting/types';

const STATUSES: { id: PaintingLeadStatus; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'site_visit_scheduled', label: 'Site Visit Scheduled' },
  { id: 'quoted', label: 'Quoted' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
];

function statusLabel(status: PaintingLeadStatus) {
  return STATUSES.find((s) => s.id === status)?.label || status;
}

export default function PaintingLeadsPanel() {
  const [leads, setLeads] = useState<PaintingLead[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [deletingId, setDeletingId] = useState('');
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (statusFilter) params.set('status', statusFilter);

    const res = await fetch(`/api/admin/painting/leads?${params}`, { credentials: 'include' });
    const data = await res.json();
    if (res.ok) {
      setLoadError('');
      setLeads(data.leads || []);
      const drafts: Record<string, string> = {};
      for (const lead of data.leads || []) {
        drafts[lead.id] = lead.notes || '';
      }
      setNotesDraft(drafts);
      return;
    }

    setLeads([]);
    setLoadError(
      data.error
        || (res.status === 403
          ? 'Access denied. Ask a Super Admin to grant Painting or Leads permission.'
          : `Could not load painting leads (HTTP ${res.status}).`),
    );
  }, [search, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(id: string, status: PaintingLeadStatus) {
    await fetch('/api/admin/painting/leads', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    load();
  }

  async function saveNotes(id: string) {
    await fetch('/api/admin/painting/leads', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, notes: notesDraft[id] || '' }),
    });
    load();
  }

  async function deleteLead(id: string) {
    if (!window.confirm('Delete this painting lead permanently?')) return;
    setDeletingId(id);
    try {
      await fetch('/api/admin/painting/leads', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      load();
    } finally {
      setDeletingId('');
    }
  }

  function exportCsv() {
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (statusFilter) params.set('status', statusFilter);
    params.set('export', 'csv');
    window.open(`/api/admin/painting/leads?${params}`, '_blank');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
          <Input
            placeholder="Search name, mobile, location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load}>Refresh</Button>
          <Button className="bg-orange-600 text-white hover:bg-orange-700" onClick={exportCsv}>
            Export CSV
          </Button>
        </div>
      </div>

      {loadError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          {loadError}
        </p>
      )}

      <div className="space-y-4">
        {!loadError && leads.length === 0 && (
          <p className="text-sm text-slate-500">No painting leads yet. Leads from /painting appear here.</p>
        )}
        {leads.map((lead) => (
          <Card key={lead.id} className="border-slate-100">
            <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_280px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black">{lead.name}</p>
                  <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">{lead.leadSource}</Badge>
                  <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">{statusLabel(lead.status)}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {lead.mobile}
                  {lead.location ? ` · ${lead.location}` : ''}
                  {lead.email ? ` · ${lead.email}` : ''}
                </p>
                {(lead.propertyType || lead.apartmentSize || lead.budget) && (
                  <p className="mt-2 text-sm text-slate-600">
                    {[lead.propertyType, lead.apartmentSize, lead.budget].filter(Boolean).join(' · ')}
                  </p>
                )}
                {lead.message && <p className="mt-2 text-sm text-slate-600">{lead.message}</p>}
                <p className="mt-2 text-xs text-slate-400">
                  {new Date(lead.createdAt).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="space-y-3">
                <select
                  value={lead.status}
                  onChange={(e) => updateStatus(lead.id, e.target.value as PaintingLeadStatus)}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  {STATUSES.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
                <Textarea
                  value={notesDraft[lead.id] || ''}
                  onChange={(e) => setNotesDraft((d) => ({ ...d, [lead.id]: e.target.value }))}
                  placeholder="Follow-up notes..."
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => saveNotes(lead.id)}>Save Notes</Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    disabled={deletingId === lead.id}
                    onClick={() => deleteLead(lead.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
