'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { DesignerCallbackLead, DesignerLeadStatus } from '@/lib/designer-leads/types';

const STATUSES: { id: DesignerLeadStatus; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'meeting_scheduled', label: 'Meeting Scheduled' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
];

const PROJECT_TYPES = ['Home', 'Office', 'Commercial', 'Rental Property', 'Other'];

function statusLabel(status: DesignerLeadStatus) {
  return STATUSES.find((s) => s.id === status)?.label || status;
}

export default function DesignerLeadsPanel() {
  const [leads, setLeads] = useState<DesignerCallbackLead[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (statusFilter) params.set('status', statusFilter);
    if (projectFilter) params.set('projectType', projectFilter);

    const res = await fetch(`/api/admin/quotation/designer-leads?${params}`, { credentials: 'include' });
    const data = await res.json();
    if (res.ok) {
      setLeads(data.leads || []);
      const drafts: Record<string, string> = {};
      for (const lead of data.leads || []) {
        drafts[lead.id] = lead.notes || '';
      }
      setNotesDraft(drafts);
    }
  }, [search, statusFilter, projectFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(id: string, status: DesignerLeadStatus) {
    await fetch('/api/admin/quotation/designer-leads', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    load();
  }

  async function saveNotes(id: string) {
    await fetch('/api/admin/quotation/designer-leads', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, notes: notesDraft[id] || '' }),
    });
    load();
  }

  function exportCsv() {
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (statusFilter) params.set('status', statusFilter);
    if (projectFilter) params.set('projectType', projectFilter);
    params.set('export', 'csv');
    window.open(`/api/admin/quotation/designer-leads?${params}`, '_blank');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
          <Input
            placeholder="Search name, phone, city, message..."
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
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">All project types</option>
            {PROJECT_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
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

      <div className="space-y-4">
        {leads.map((lead) => (
          <Card key={lead.id} className="border-slate-100">
            <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_260px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black">{lead.name}</p>
                  <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">{lead.source}</Badge>
                  <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">{statusLabel(lead.status)}</Badge>
                  {lead.projectType && (
                    <Badge variant="outline">{lead.projectType}</Badge>
                  )}
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {lead.phone}
                  {lead.city ? ` · ${lead.city}` : ''}
                  {lead.preferredCallTime ? ` · Call: ${lead.preferredCallTime}` : ''}
                </p>
                {lead.message && <p className="mt-2 text-sm text-slate-600">{lead.message}</p>}
                {lead.aiContext?.projectCategory && (
                  <p className="mt-2 text-sm text-slate-600">
                    AI context: {lead.aiContext.projectCategory}
                    {lead.aiContext.phase ? ` · Phase: ${lead.aiContext.phase}` : ''}
                    {lead.aiContext.consultationId ? ` · Consultation: ${lead.aiContext.consultationId}` : ''}
                  </p>
                )}
                {lead.aiContext?.conversation && lead.aiContext.conversation.length > 0 && (
                  <details className="mt-2 text-sm text-slate-600">
                    <summary className="cursor-pointer font-semibold text-slate-700">View AI conversation</summary>
                    <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-md bg-slate-50 p-3 text-xs">
                      {lead.aiContext.conversation.map((msg, i) => (
                        <p key={i}>
                          <span className="font-bold capitalize">{msg.role}:</span> {msg.content}
                        </p>
                      ))}
                    </div>
                  </details>
                )}
                <p className="mt-1 text-xs text-slate-500">
                  ID: {lead.id} · Page: {lead.landingPage} · {new Date(lead.createdAt).toLocaleString('en-IN')}
                </p>
                <div className="mt-3">
                  <Textarea
                    placeholder="Admin notes..."
                    value={notesDraft[lead.id] ?? ''}
                    onChange={(e) => setNotesDraft((d) => ({ ...d, [lead.id]: e.target.value }))}
                    className="min-h-[72px] text-sm"
                  />
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => saveNotes(lead.id)}>
                    Save Notes
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Update Status</p>
                <div className="flex flex-wrap gap-2">
                  {STATUSES.map((s) => (
                    <Button
                      key={s.id}
                      size="sm"
                      variant={lead.status === s.id ? 'default' : 'outline'}
                      className={lead.status === s.id ? 'bg-orange-600 text-white' : ''}
                      onClick={() => updateStatus(lead.id, s.id)}
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!leads.length && <p className="text-slate-500">No human designer callback requests yet.</p>}
      </div>
    </div>
  );
}
