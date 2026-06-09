'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { LeadStatus, QuotationLead } from '@/lib/estimate/types';

const STATUSES: LeadStatus[] = ['new', 'contacted', 'site_visit', 'negotiation', 'won', 'lost'];

export default function QuotationLeadsPanel() {
  const [leads, setLeads] = useState<QuotationLead[]>([]);

  async function load() {
    const res = await fetch('/api/admin/quotation/leads', { credentials: 'include' });
    const data = await res.json();
    if (res.ok) setLeads(data.leads || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function updateStatus(id: string, status: LeadStatus) {
    await fetch('/api/admin/quotation/leads', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    load();
  }

  return (
    <div className="space-y-4">
      {leads.map((lead) => (
        <Card key={lead.id} className="border-slate-100">
          <CardContent className="grid gap-4 p-5 md:grid-cols-[1fr_auto]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-black">{lead.customer?.name || 'Unknown'}</p>
                <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">{lead.quoteNumber}</Badge>
                <Badge variant="outline">{lead.moduleId}</Badge>
                {lead.propertyPurpose && (
                  <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">{lead.propertyPurpose}</Badge>
                )}
              </div>
              <p className="mt-2 text-sm text-slate-600">{lead.customer?.phone} · {lead.customer?.email}</p>
              <p className="mt-1 text-sm text-slate-600">{lead.pricing.formattedRange} · {lead.landingPage}</p>
              <p className="mt-1 text-xs text-slate-500">Source: {lead.leadSource} · {new Date(lead.createdAt).toLocaleString('en-IN')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((status) => (
                <Button key={status} size="sm" variant={lead.status === status ? 'default' : 'outline'} className={lead.status === status ? 'bg-orange-600 text-white' : ''} onClick={() => updateStatus(lead.id, status)}>
                  {status}
                </Button>
              ))}
              <a href={`/api/estimate/quote/${lead.id}/pdf`} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline">PDF</Button>
              </a>
            </div>
          </CardContent>
        </Card>
      ))}
      {!leads.length && <p className="text-slate-500">No AI quotation leads yet.</p>}
    </div>
  );
}
