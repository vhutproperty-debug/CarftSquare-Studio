'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { ConsultationDraft, EstimateModuleId, LeadStatus, QuotationLead } from '@/lib/estimate/types';

const STATUSES: { id: LeadStatus; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'meeting_scheduled', label: 'Meeting Scheduled' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
];

const MODULES: EstimateModuleId[] = [
  'home-interior',
  'rental-furnishing',
  'modular-kitchen',
  'wardrobe',
  'office-interior',
  'commercial-interior',
];

function statusLabel(status: LeadStatus) {
  return STATUSES.find((s) => s.id === status)?.label || status.replace(/_/g, ' ');
}

type LeadView = 'quotes' | 'drafts';

export default function QuotationLeadsPanel() {
  const [view, setView] = useState<LeadView>('quotes');
  const [leads, setLeads] = useState<QuotationLead[]>([]);
  const [drafts, setDrafts] = useState<ConsultationDraft[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (view === 'drafts') {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      const res = await fetch(`/api/admin/quotation/consultations?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setDrafts(data.consultations || []);
      return;
    }

    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (statusFilter) params.set('status', statusFilter);
    if (moduleFilter) params.set('moduleId', moduleFilter);
    const res = await fetch(`/api/admin/quotation/leads?${params}`, { credentials: 'include' });
    const data = await res.json();
    if (res.ok) {
      setLeads(data.leads || []);
      const noteDrafts: Record<string, string> = {};
      for (const lead of data.leads || []) {
        noteDrafts[lead.id] = lead.notes || '';
      }
      setNotesDraft(noteDrafts);
    }
  }, [search, statusFilter, moduleFilter, view]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(id: string, status: LeadStatus) {
    await fetch('/api/admin/quotation/leads', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    load();
  }

  async function saveNotes(id: string) {
    await fetch('/api/admin/quotation/leads', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, notes: notesDraft[id] || '' }),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => setView('quotes')}
          className={view === 'quotes' ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-700'}
        >
          Converted Leads
        </Button>
        <Button
          onClick={() => setView('drafts')}
          className={view === 'drafts' ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-700'}
        >
          Consultation Drafts
        </Button>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Input
          placeholder={view === 'drafts' ? 'Search category, module, summary...' : 'Search name, phone, city, quote ID...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
        {view === 'quotes' && (
          <>
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
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">All modules</option>
              {MODULES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </>
        )}
        <Button variant="outline" onClick={load}>Refresh</Button>
      </div>

      {view === 'drafts' && (
        <div className="space-y-4">
          {drafts.map((draft) => (
            <Card key={draft.id} className="border-slate-100">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black">{draft.projectCategory}</p>
                  <Badge variant="outline">{draft.moduleId}</Badge>
                  <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">
                    Score: {draft.leadScore}
                  </Badge>
                  {draft.convertedQuoteId && (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Converted</Badge>
                  )}
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Budget: {draft.aiSummary?.budget || '—'} · Timeline: {draft.timeline || draft.aiSummary?.timeline || '—'}
                </p>
                {draft.aiSummary?.customerRequirementSummary && (
                  <p className="mt-2 text-sm text-slate-600">{draft.aiSummary.customerRequirementSummary}</p>
                )}
                <p className="mt-1 text-xs text-slate-500">
                  ID: {draft.id} · Source: {draft.leadSource} · {new Date(draft.createdAt).toLocaleString('en-IN')}
                </p>
                <details className="mt-3 text-sm text-slate-600">
                  <summary className="cursor-pointer font-semibold text-slate-700">View conversation</summary>
                  <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-md bg-slate-50 p-3 text-xs">
                    {draft.conversation.map((msg, i) => (
                      <p key={i}>
                        <span className="font-bold capitalize">{msg.role}:</span> {msg.content}
                      </p>
                    ))}
                  </div>
                </details>
              </CardContent>
            </Card>
          ))}
          {!drafts.length && (
            <p className="text-slate-500">No incomplete AI consultations found.</p>
          )}
        </div>
      )}

      {view === 'quotes' && <div className="space-y-4">
        {leads.map((lead) => (
          <Card key={lead.id} className="border-slate-100">
            <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_280px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black">{lead.customer?.name || 'Unknown'}</p>
                  <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">{lead.quoteNumber}</Badge>
                  <Badge variant="outline">{lead.moduleId}</Badge>
                  <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">{statusLabel(lead.status)}</Badge>
                  {lead.propertyPurpose && (
                    <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">{lead.propertyPurpose}</Badge>
                  )}
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {lead.customer?.phone}
                  {lead.customer?.email ? ` · ${lead.customer.email}` : ''}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {lead.pricing?.formattedRange} · {lead.projectCategory || lead.moduleId} · {lead.area || 0} sq.ft
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Budget: {lead.budget || lead.aiSummary?.budget || '—'} · Timeline:{' '}
                  {lead.timeline || lead.aiSummary?.timeline || '—'} · Lead Score:{' '}
                  <span className="font-bold text-orange-600">{lead.leadScore ?? 0}</span>
                </p>
                {lead.aiSummary?.customerRequirementSummary && (
                  <p className="mt-2 text-sm text-slate-600">{lead.aiSummary.customerRequirementSummary}</p>
                )}
                {lead.conversation?.length > 0 && (
                  <details className="mt-2 text-sm text-slate-600">
                    <summary className="cursor-pointer font-semibold text-slate-700">View conversation</summary>
                    <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-md bg-slate-50 p-3 text-xs">
                      {lead.conversation.map((msg, i) => (
                        <p key={i}>
                          <span className="font-bold capitalize">{msg.role}:</span> {msg.content}
                        </p>
                      ))}
                    </div>
                  </details>
                )}
                <p className="mt-1 text-xs text-slate-500">
                  ID: {lead.id} · Source: {lead.leadSource} · {new Date(lead.createdAt).toLocaleString('en-IN')}
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
                <a href={`/api/estimate/quote/${lead.id}/pdf`} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline" className="w-full">Download PDF</Button>
                </a>
              </div>
            </CardContent>
          </Card>
        ))}
        {!leads.length && <p className="text-slate-500">No AI consultation enquiries found.</p>}
      </div>}
    </div>
  );
}
