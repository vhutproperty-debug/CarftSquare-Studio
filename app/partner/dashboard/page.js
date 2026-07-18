'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import BrandLogo from '@/components/BrandLogo';
import LeadPipelineTracker, { formatLeadActivityLabel } from '@/components/partner-network/LeadPipelineTracker';
import { LEAD_PIPELINE, formatLeadStageLabel } from '@/lib/partner-network/pipeline';

export default function PartnerDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [leadForm, setLeadForm] = useState({
    clientName: '', mobile: '', project: '', society: '', location: '',
    rentalInterior: false, homeInterior: true, budget: '', possessionDate: '', remarks: '',
  });
  const [submitMsg, setSubmitMsg] = useState('');

  const loadDashboard = useCallback(async () => {
    const res = await fetch('/api/partner-network/dashboard', { credentials: 'include' });
    if (res.status === 401) {
      router.replace('/partner/login');
      return null;
    }
    return res.json();
  }, [router]);

  useEffect(() => {
    loadDashboard()
      .then((d) => { if (d) setData(d); })
      .finally(() => setLoading(false));
  }, [loadDashboard]);

  async function submitLead(e) {
    e.preventDefault();
    setSubmitMsg('');
    const res = await fetch('/api/partner-network/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(leadForm),
    });
    const d = await res.json();
    if (!res.ok) { setSubmitMsg(d.error || 'Failed'); return; }
    setSubmitMsg(`Lead ${d.lead.leadId} submitted successfully.`);
    setData(await loadDashboard());
  }

  async function logout() {
    await fetch('/api/partner-network/auth/status', { method: 'POST', credentials: 'include' });
    router.push('/partner/login');
  }

  if (loading) return <div className="grid min-h-screen place-items-center bg-slate-50">Loading dashboard...</div>;
  if (!data?.partner) return null;

  const { partner, stats, leads, activity } = data;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/partner"><BrandLogo variant="nav" /></Link>
          <div className="flex items-center gap-4">
            <Badge className="bg-orange-100 text-orange-800">{partner.partnerId}</Badge>
            <Button variant="outline" size="sm" onClick={logout}>Logout</Button>
          </div>
        </div>
      </header>

      <div className="container space-y-8 py-10">
        <div>
          <h1 className="text-3xl font-black">Welcome, {partner.fullName}</h1>
          <p className="text-slate-600">{partner.companyName} · {partner.email}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total Leads', value: stats.totalLeads },
            { label: 'Qualified', value: stats.qualifiedLeads },
            { label: 'Projects Won', value: stats.projectsWon },
            { label: 'Commission Pending', value: `₹${stats.commissionPending.toLocaleString()}` },
          ].map((s) => (
            <Card key={s.label}><CardContent className="p-5"><p className="text-sm text-slate-500">{s.label}</p><p className="text-2xl font-black text-orange-600">{s.value}</p></CardContent></Card>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Submit Client Lead</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={submitLead} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label>Client Name</Label><Input required value={leadForm.clientName} onChange={(e) => setLeadForm({ ...leadForm, clientName: e.target.value })} /></div>
                  <div><Label>Mobile</Label><Input required type="tel" value={leadForm.mobile} onChange={(e) => setLeadForm({ ...leadForm, mobile: e.target.value })} /></div>
                  <div><Label>Project</Label><Input required value={leadForm.project} onChange={(e) => setLeadForm({ ...leadForm, project: e.target.value })} /></div>
                  <div><Label>Society</Label><Input value={leadForm.society} onChange={(e) => setLeadForm({ ...leadForm, society: e.target.value })} /></div>
                  <div><Label>Location</Label><Input required value={leadForm.location} onChange={(e) => setLeadForm({ ...leadForm, location: e.target.value })} /></div>
                  <div><Label>Budget</Label><Input required value={leadForm.budget} onChange={(e) => setLeadForm({ ...leadForm, budget: e.target.value })} /></div>
                  <div><Label>Possession Date</Label><Input value={leadForm.possessionDate} onChange={(e) => setLeadForm({ ...leadForm, possessionDate: e.target.value })} /></div>
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm"><Checkbox checked={leadForm.rentalInterior} onCheckedChange={(v) => setLeadForm({ ...leadForm, rentalInterior: Boolean(v) })} /> Rental Interior</label>
                  <label className="flex items-center gap-2 text-sm"><Checkbox checked={leadForm.homeInterior} onCheckedChange={(v) => setLeadForm({ ...leadForm, homeInterior: Boolean(v) })} /> Home Interior</label>
                </div>
                <div><Label>Remarks</Label><Input value={leadForm.remarks} onChange={(e) => setLeadForm({ ...leadForm, remarks: e.target.value })} /></div>
                {submitMsg && <p className="text-sm font-semibold text-emerald-700">{submitMsg}</p>}
                <Button type="submit" className="bg-orange-600 font-bold text-white hover:bg-orange-700">Submit Lead</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Lead History</CardTitle></CardHeader>
            <CardContent className="max-h-[32rem] space-y-4 overflow-y-auto">
              {leads?.length ? leads.map((lead) => (
                <div key={lead.id} className="rounded-xl border border-slate-100 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-bold">{lead.clientName}</span>
                    <Badge variant="outline">{lead.leadId}</Badge>
                  </div>
                  <p className="mb-3 text-sm text-slate-500">{lead.location} · {lead.mobile}</p>
                  <LeadPipelineTracker status={lead.status} compact />
                </div>
              )) : <p className="text-slate-500">No leads yet. Submit your first client above.</p>}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Pipeline Overview</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-slate-500">Lead counts by stage (synced from Admin CRM)</p>
            <div className="flex flex-wrap gap-2">
              {LEAD_PIPELINE.map((stage) => {
                const count = stats.leadsByStatus?.[stage] ?? 0;
                return (
                  <Badge
                    key={stage}
                    variant="outline"
                    className={`capitalize ${count > 0 ? 'border-orange-300 bg-orange-50 text-orange-800' : 'border-slate-200 text-slate-400'}`}
                  >
                    {formatLeadStageLabel(stage)}{count > 0 ? ` (${count})` : ''}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Activity Timeline</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {activity?.length ? activity.map((a) => (
              <div key={a.id} className="flex gap-3 border-l-2 border-orange-200 pl-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">{formatLeadActivityLabel(a)}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(a.createdAt).toLocaleString()}
                    {a.actorType === 'admin' ? ' · Updated by CraftSquare team' : ''}
                  </p>
                </div>
              </div>
            )) : <p className="text-sm text-slate-500">Activity will appear here when leads are submitted or updated.</p>}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
