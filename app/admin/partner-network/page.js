'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity, BarChart3, Check, Download, Handshake, Home, Phone, Settings, Users, Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { canAccess } from '@/lib/auth/rbac/client';
import { TRUST_COUNTER_LABELS, DEFAULT_TRUST_COUNTERS } from '@/lib/partner-network/constants';
import { LEAD_PIPELINE } from '@/lib/partner-network/pipeline';
import PartnerCallbackRequestsPanel from '@/components/admin/partner-network/PartnerCallbackRequestsPanel';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'partners', label: 'Partners', icon: Users },
  { id: 'leads', label: 'Partner Leads', icon: Handshake },
  { id: 'callbacks', label: 'Partner Callback Requests', icon: Phone },
  { id: 'commission', label: 'Commission', icon: Wallet },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'activity', label: 'Activity Logs', icon: Activity },
  { id: 'settings', label: 'Trust Counters', icon: Settings },
];

const PARTNERS_PAGE_SIZE = 20;
const LEADS_PAGE_SIZE = 20;
const ACTIVITY_PAGE_SIZE = 50;

const PARTNER_ACTION_BTN = 'min-w-[120px] shrink-0 whitespace-nowrap px-4 font-semibold';

function PartnerStatusBadge({ status }) {
  const config = {
    pending: { label: 'Pending', className: 'border-amber-400/60 bg-amber-500/25 text-amber-100' },
    approved: { label: 'Approved', className: 'border-emerald-500/60 bg-emerald-600/30 text-emerald-50' },
    rejected: { label: 'Rejected', className: 'border-red-500/60 bg-red-600/30 text-red-50' },
    suspended: { label: 'Suspended', className: 'border-amber-400/60 bg-amber-500/25 text-amber-100' },
  };
  const item = config[status] || config.pending;
  return (
    <Badge className={`border font-semibold ${item.className}`}>
      {item.label}
    </Badge>
  );
}

function PartnerRowActions({ partner, user, onUpdate, updatingId }) {
  const canEdit = canAccess(user, 'partner_network', 'edit');
  const isUpdating = updatingId === partner.id;

  if (partner.status === 'approved') {
    return (
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          size="sm"
          disabled
          className={`${PARTNER_ACTION_BTN} cursor-default border border-emerald-500/40 bg-emerald-800/60 text-white opacity-100`}
        >
          <Check className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Approved
        </Button>
        {canEdit && (
          <Button
            type="button"
            size="sm"
            disabled={isUpdating}
            className={`${PARTNER_ACTION_BTN} border border-slate-400 bg-slate-800 text-white hover:bg-slate-700`}
            onClick={() => onUpdate(partner.id, 'suspended')}
          >
            Suspend
          </Button>
        )}
      </div>
    );
  }

  if (partner.status === 'rejected') {
    return (
      <Button
        type="button"
        size="sm"
        disabled
        className={`${PARTNER_ACTION_BTN} cursor-default border border-red-500/40 bg-red-900/50 text-red-100 opacity-100`}
      >
        Rejected
      </Button>
    );
  }

  if (partner.status === 'suspended' && canEdit) {
    return (
      <Button
        type="button"
        size="sm"
        disabled={isUpdating}
        className={`${PARTNER_ACTION_BTN} bg-emerald-600 text-white hover:bg-emerald-500`}
        onClick={() => onUpdate(partner.id, 'approved')}
      >
        {isUpdating ? 'Saving…' : 'Activate'}
      </Button>
    );
  }

  if (partner.status === 'pending') {
    if (!canEdit) {
      return (
        <Button
          type="button"
          size="sm"
          disabled
          title="You do not have permission to approve partners"
          className={`${PARTNER_ACTION_BTN} border border-slate-600 bg-slate-900 text-slate-300`}
        >
          Approve
        </Button>
      );
    }

    return (
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          type="button"
          size="sm"
          asChild
          className={`${PARTNER_ACTION_BTN} border border-slate-300 bg-slate-800 text-white hover:bg-slate-700`}
        >
          <a href={`tel:${partner.mobile}`}>Contact</a>
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isUpdating}
          className={`${PARTNER_ACTION_BTN} bg-emerald-600 text-white shadow-sm hover:bg-emerald-500`}
          onClick={() => onUpdate(partner.id, 'approved')}
        >
          {isUpdating ? 'Saving…' : 'Approve'}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isUpdating}
          className={`${PARTNER_ACTION_BTN} bg-red-600 text-white shadow-sm hover:bg-red-500`}
          onClick={() => onUpdate(partner.id, 'rejected')}
        >
          {isUpdating ? 'Saving…' : 'Reject'}
        </Button>
      </div>
    );
  }

  return null;
}

function LeadCommissionPanel({ lead, canEdit, saving, onSave }) {
  const [draft, setDraft] = useState({
    commissionAmount: lead.commissionAmount ?? '',
    commissionType: lead.commissionType || 'fixed',
    commissionStatus: lead.commissionStatus || 'pending',
    paymentRemarks: lead.paymentRemarks || '',
    paymentDate: lead.paymentDate ? String(lead.paymentDate).slice(0, 10) : '',
  });

  useEffect(() => {
    setDraft({
      commissionAmount: lead.commissionAmount ?? '',
      commissionType: lead.commissionType || 'fixed',
      commissionStatus: lead.commissionStatus || 'pending',
      paymentRemarks: lead.paymentRemarks || '',
      paymentDate: lead.paymentDate ? String(lead.paymentDate).slice(0, 10) : '',
    });
  }, [lead.id, lead.commissionAmount, lead.commissionType, lead.commissionStatus, lead.paymentRemarks, lead.paymentDate]);

  if (!canEdit) {
    return (
      <p className="text-xs text-slate-400">
        {lead.commissionAmount
          ? `₹${Number(lead.commissionAmount).toLocaleString('en-IN')} · ${lead.commissionType || 'fixed'} · ${lead.commissionStatus || 'pending'}`
          : 'No commission configured'}
        {lead.paymentDate ? ` · Paid ${new Date(lead.paymentDate).toLocaleDateString()}` : ''}
      </p>
    );
  }

  function setField(key, value) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    const amount = draft.commissionAmount === '' ? undefined : Number(draft.commissionAmount);
    onSave(lead.id, {
      commissionAmount: Number.isFinite(amount) ? amount : undefined,
      commissionType: draft.commissionType,
      commissionStatus: draft.commissionStatus,
      paymentRemarks: draft.paymentRemarks,
      paymentDate: draft.paymentDate ? new Date(`${draft.paymentDate}T12:00:00`).toISOString() : '',
    });
  }

  return (
    <div className="w-full space-y-3 rounded-lg border border-white/10 bg-slate-900/40 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Commission (lead record)</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div>
          <label className="mb-1 block text-xs text-slate-400">Amount (₹)</label>
          <Input
            type="number"
            min="0"
            step="1"
            value={draft.commissionAmount}
            onChange={(e) => setField('commissionAmount', e.target.value)}
            className="bg-white/10 text-white"
            placeholder="0"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Type</label>
          <Select value={draft.commissionType} onValueChange={(v) => setField('commissionType', v)}>
            <SelectTrigger className="bg-white/10 text-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed">Fixed</SelectItem>
              <SelectItem value="percentage">Percentage</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Status</label>
          <Select value={draft.commissionStatus} onValueChange={(v) => setField('commissionStatus', v)}>
            <SelectTrigger className="bg-white/10 text-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Payment date</label>
          <Input
            type="date"
            value={draft.paymentDate}
            onChange={(e) => setField('paymentDate', e.target.value)}
            className="bg-white/10 text-white"
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-2 xl:col-span-2">
          <label className="mb-1 block text-xs text-slate-400">Payment remarks</label>
          <Input
            value={draft.paymentRemarks}
            onChange={(e) => setField('paymentRemarks', e.target.value)}
            className="bg-white/10 text-white"
            placeholder="UTR, reference, notes…"
          />
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        disabled={saving}
        className="bg-orange-600 text-white hover:bg-orange-500"
        onClick={handleSave}
      >
        {saving ? 'Saving…' : 'Save Commission'}
      </Button>
    </div>
  );
}

function ListPagination({ page, totalPages, total, onPageChange, label }) {
  if (!total) return null;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-400">
        {label}: {total} total · Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-white/20 bg-white/5 text-white"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-white/20 bg-white/5 text-white"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export default function PartnerNetworkAdminPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('dashboard');
  const [dash, setDash] = useState(null);
  const [partners, setPartners] = useState([]);
  const [leads, setLeads] = useState([]);
  const [activity, setActivity] = useState([]);
  const [counters, setCounters] = useState(DEFAULT_TRUST_COUNTERS);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [leadQ, setLeadQ] = useState('');
  const [debouncedLeadQ, setDebouncedLeadQ] = useState('');
  const [partnerStatusFilter, setPartnerStatusFilter] = useState('pending');
  const [partnerPage, setPartnerPage] = useState(1);
  const [partnersMeta, setPartnersMeta] = useState({ total: 0, totalPages: 1 });
  const [leadPage, setLeadPage] = useState(1);
  const [leadsMeta, setLeadsMeta] = useState({ total: 0, totalPages: 1 });
  const [activityPage, setActivityPage] = useState(1);
  const [activityMeta, setActivityMeta] = useState({ total: 0, totalPages: 1 });
  const [message, setMessage] = useState('');
  const [updatingPartnerId, setUpdatingPartnerId] = useState(null);
  const [updatingLeadId, setUpdatingLeadId] = useState(null);

  const apiFetch = useCallback((url, opts = {}) => fetch(url, { ...opts, credentials: 'include' }), []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedLeadQ(leadQ), 300);
    return () => clearTimeout(timer);
  }, [leadQ]);

  useEffect(() => {
    setPartnerPage(1);
  }, [debouncedQ, partnerStatusFilter]);

  useEffect(() => {
    setLeadPage(1);
  }, [debouncedLeadQ]);

  useEffect(() => {
    apiFetch('/api/auth/status').then((r) => r.json()).then((d) => {
      setAuthed(Boolean(d.authenticated));
      setUser(d.user || null);
      if (d.authenticated && !canAccess(d.user, 'partner_network', 'view')) {
        router.replace('/admin?denied=partner_network');
      }
    });
  }, [apiFetch, router]);

  const loadDashboard = useCallback(() => {
    apiFetch('/api/admin/partner-network/dashboard').then((r) => r.json()).then(setDash);
  }, [apiFetch]);

  const loadPartners = useCallback(() => {
    const params = new URLSearchParams({
      q: debouncedQ,
      page: String(partnerPage),
      limit: String(PARTNERS_PAGE_SIZE),
    });
    if (partnerStatusFilter !== 'all') params.set('status', partnerStatusFilter);
    apiFetch(`/api/admin/partner-network/partners?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setPartners(d.partners || []);
        setPartnersMeta({ total: d.total ?? 0, totalPages: d.totalPages ?? 1 });
      });
  }, [apiFetch, debouncedQ, partnerPage, partnerStatusFilter]);

  const loadLeads = useCallback(() => {
    const params = new URLSearchParams({
      q: debouncedLeadQ,
      page: String(leadPage),
      limit: String(LEADS_PAGE_SIZE),
    });
    apiFetch(`/api/admin/partner-network/leads?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setLeads(d.leads || []);
        setLeadsMeta({ total: d.total ?? 0, totalPages: d.totalPages ?? 1 });
      });
  }, [apiFetch, debouncedLeadQ, leadPage]);

  const loadActivity = useCallback(() => {
    const params = new URLSearchParams({
      section: 'activity',
      page: String(activityPage),
      limit: String(ACTIVITY_PAGE_SIZE),
    });
    apiFetch(`/api/admin/partner-network/settings?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setActivity(d.activity || []);
        setActivityMeta({ total: d.total ?? 0, totalPages: d.totalPages ?? 1 });
      });
  }, [apiFetch, activityPage]);

  useEffect(() => {
    if (!authed) return;
    if (tab === 'dashboard' || tab === 'analytics' || tab === 'commission') loadDashboard();
    if (tab === 'partners') loadPartners();
    if (tab === 'leads' || tab === 'commission') loadLeads();
    if (tab === 'activity') loadActivity();
    if (tab === 'settings' && dash?.trustCounters) setCounters(dash.trustCounters);
  }, [authed, tab, loadDashboard, loadPartners, loadLeads, loadActivity, dash, partnerPage, partnerStatusFilter]);

  async function updatePartner(id, status) {
    if (!id) {
      console.error('[partner-crm] approve:blocked — missing partner id');
      setMessage('Cannot update partner: missing id.');
      return;
    }

    const previousPartners = partners;

    setUpdatingPartnerId(id);

    try {
      const res = await apiFetch('/api/admin/partner-network/partners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json().catch(() => ({}));
      console.log('[partner-crm] approve:response', { ok: res.ok, statusCode: res.status, data });

      if (!res.ok) {
        setPartners(previousPartners);
        const errMsg = typeof data.error === 'string'
          ? data.error
          : data.error?.message || `Partner update failed (${res.status})`;
        setMessage(errMsg);
        return;
      }

      if (data.partner) {
        setPartners((prev) => prev.map((p) => (p.id === id ? { ...p, ...data.partner } : p)));
      }

      setMessage(status === 'approved' ? 'Partner approved' : `Partner ${status}`);
      loadPartners();
      loadDashboard();
      if (tab === 'activity') loadActivity();
    } catch (error) {
      console.error('[partner-crm] approve:error', error);
      setPartners(previousPartners);
      setMessage(error instanceof Error ? error.message : 'Network error while updating partner.');
    } finally {
      setUpdatingPartnerId(null);
    }
  }

  async function updateLead(id, fields) {
    setUpdatingLeadId(id);
    try {
      const res = await apiFetch('/api/admin/partner-network/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...fields }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = typeof data.error === 'string' ? data.error : `Lead update failed (${res.status})`;
        setMessage(errMsg);
        return;
      }
      if (data.lead) {
        setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...data.lead } : l)));
      }
      setMessage(fields.status ? `Lead → ${fields.status}` : 'Commission saved');
      loadLeads();
      loadDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Network error while updating lead.');
    } finally {
      setUpdatingLeadId(null);
    }
  }

  async function saveCounters() {
    const res = await apiFetch('/api/admin/partner-network/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'trust_counters', data: counters }),
    });
    setMessage(res.ok ? 'Trust counters saved' : 'Save failed');
  }

  if (!authed) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950 text-white">
        <Card className="max-w-md"><CardContent className="p-8 text-center text-slate-950">
          <p className="font-bold">Admin login required.</p>
          <Link href="/admin"><Button className="mt-4 bg-orange-600 text-white">Go to Admin</Button></Link>
        </CardContent></Card>
      </div>
    );
  }

  const stats = dash?.stats;

  return (
    <main className="min-h-screen bg-slate-950 py-10 text-white">
      <div className="container space-y-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <Badge className="mb-3 bg-orange-500 text-white hover:bg-orange-500">Partner Network</Badge>
            <h1 className="text-3xl font-black md:text-5xl">Partner CRM</h1>
            <p className="mt-2 text-slate-300">Isolated partner ecosystem — does not affect existing leads or CRM.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin"><Button variant="outline" className="border-white/20 bg-white/10 text-white"><Home className="mr-2 h-4 w-4" /> Main Admin</Button></Link>
            <a href="/api/admin/partner-network/dashboard?export=partners-csv" target="_blank" rel="noreferrer"><Button variant="outline" className="border-white/20 bg-white/10 text-white"><Download className="mr-2 h-4 w-4" /> Export CSV</Button></a>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Button key={t.id} variant={tab === t.id ? 'default' : 'outline'} className={tab === t.id ? 'bg-orange-600 text-white' : 'border-white/20 bg-white/5 text-white'} onClick={() => setTab(t.id)}>
              <t.icon className="mr-2 h-4 w-4" />{t.label}
            </Button>
          ))}
        </div>

        {message && <p className="text-sm font-semibold text-orange-300">{message}</p>}

        {(tab === 'dashboard' || tab === 'analytics') && stats && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {[
                { l: 'Total Partners', v: stats.totalPartners },
                { l: 'Approved', v: stats.approvedPartners ?? 0 },
                { l: 'Pending', v: stats.pendingPartners ?? stats.pendingApproval ?? 0 },
                { l: 'Rejected', v: stats.rejectedPartners ?? 0 },
                { l: 'Incomplete', v: stats.incompleteRegistrations ?? 0 },
                { l: 'Total Leads', v: stats.totalLeads },
                { l: 'Won Leads', v: stats.wonLeads ?? stats.projectsWon ?? 0 },
                { l: 'Lead-to-Won %', v: `${stats.conversionRatio}%` },
                { l: 'Commission Pending', v: `₹${(stats.commissionPending ?? 0).toLocaleString('en-IN')}` },
                { l: 'Commission Paid', v: `₹${(stats.commissionPaid ?? stats.commissionReleased ?? 0).toLocaleString('en-IN')}` },
              ].map((s) => (
                <Card key={s.l} className="border-white/10 bg-white/5"><CardContent className="p-4"><p className="text-xs text-slate-400">{s.l}</p><p className="text-2xl font-black text-orange-400">{s.v}</p></CardContent></Card>
              ))}
            </div>
            {tab === 'analytics' && (
              <Card className="border-white/10 bg-white/5">
                <CardHeader><CardTitle>Monthly Trends</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  {stats.monthlyTrends?.map((m) => (
                    <Badge key={m.month} className="bg-orange-600/20 text-orange-200">{m.month}: {m.count} leads</Badge>
                  ))}
                </CardContent>
              </Card>
            )}
            <Card className="border-white/10 bg-white/5">
              <CardHeader><CardTitle>Lead Pipeline Overview</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {LEAD_PIPELINE.map((s) => {
                  const count = stats.leadsByStatus?.[s] ?? 0;
                  return (
                    <Badge key={s} variant="outline" className={`border-white/20 capitalize ${count > 0 ? 'text-orange-200' : 'text-slate-300'}`}>
                      {s.replace(/_/g, ' ')}{count > 0 ? ` (${count})` : ''}
                    </Badge>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        )}

        {tab === 'partners' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'pending', label: 'Pending Approval' },
                { id: 'approved', label: 'Approved' },
                { id: 'rejected', label: 'Rejected' },
                { id: 'all', label: 'All Partners' },
              ].map((f) => (
                <Button
                  key={f.id}
                  variant={partnerStatusFilter === f.id ? 'default' : 'outline'}
                  className={partnerStatusFilter === f.id ? 'bg-orange-600 text-white' : 'border-white/20 bg-white/5 text-white'}
                  onClick={() => setPartnerStatusFilter(f.id)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
            <Input placeholder="Search partners..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md bg-white/10 text-white" />
            <ListPagination
              label="Partners"
              page={partnerPage}
              totalPages={partnersMeta.totalPages}
              total={partnersMeta.total}
              onPageChange={setPartnerPage}
            />
            <div className="space-y-3">
              {partners.map((p) => {
                const pct = p.profileCompletionPercent ?? 25;
                return (
                <Card key={p.id} className="border-white/10 bg-white/5">
                  <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-white">{p.fullName}</p>
                        <Badge className="bg-orange-600/30 font-semibold text-orange-100">{p.partnerId}</Badge>
                        <PartnerStatusBadge status={p.status} />
                        {p.registrationStatus === 'incomplete' && (
                          <Badge variant="outline" className="border-slate-500 text-slate-300">Profile incomplete</Badge>
                        )}
                        <Badge variant="outline" className="border-emerald-500/40 font-medium text-emerald-200">{pct}% profile</Badge>
                      </div>
                      <p className="text-sm text-slate-300">
                        <a href={`tel:${p.mobile}`} className="font-medium text-white underline-offset-2 hover:text-orange-300 hover:underline">{p.mobile}</a>
                        {p.companyName ? ` · ${p.companyName}` : ''}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                        <span>Source: {p.leadSource || 'organic'}</span>
                        <span>Registered: {p.createdAt ? new Date(p.createdAt).toLocaleString() : '—'}</span>
                        <span>Last activity: {p.lastActivityAt ? new Date(p.lastActivityAt).toLocaleString() : '—'}</span>
                      </div>
                      <div className="h-1.5 max-w-xs overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full rounded-full bg-orange-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <PartnerRowActions partner={p} user={user} onUpdate={updatePartner} updatingId={updatingPartnerId} />
                  </CardContent>
                </Card>
              );})}
            </div>
            {!partners.length && <p className="text-slate-400">No partners found.</p>}
            <ListPagination
              label="Partners"
              page={partnerPage}
              totalPages={partnersMeta.totalPages}
              total={partnersMeta.total}
              onPageChange={setPartnerPage}
            />
          </div>
        )}

        {tab === 'leads' && (
          <div className="space-y-3">
            <Input placeholder="Search leads..." value={leadQ} onChange={(e) => setLeadQ(e.target.value)} className="max-w-md bg-white/10 text-white" />
            <ListPagination
              label="Leads"
              page={leadPage}
              totalPages={leadsMeta.totalPages}
              total={leadsMeta.total}
              onPageChange={setLeadPage}
            />
            {leads.map((l) => (
              <Card key={l.id} className="border-white/10 bg-white/5">
                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="font-bold">{l.clientName} <Badge variant="outline" className="ml-2 border-white/20">{l.leadId}</Badge></p>
                      <p className="text-sm text-slate-400">{l.partnerId} · {l.location} · {l.mobile}</p>
                      <Badge className="mt-2 capitalize" variant="outline">{l.status.replace(/_/g, ' ')}</Badge>
                    </div>
                    {canAccess(user, 'partner_network', 'edit') && (
                      <Select value={l.status} onValueChange={(v) => updateLead(l.id, { status: v })}>
                        <SelectTrigger className="w-44 bg-white/10 text-white"><SelectValue /></SelectTrigger>
                        <SelectContent>{LEAD_PIPELINE.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                      </Select>
                    )}
                  </div>
                  <LeadCommissionPanel
                    lead={l}
                    canEdit={canAccess(user, 'partner_network', 'edit')}
                    saving={updatingLeadId === l.id}
                    onSave={updateLead}
                  />
                </CardContent>
              </Card>
            ))}
            {!leads.length && <p className="text-slate-400">No partner leads yet.</p>}
            <ListPagination
              label="Leads"
              page={leadPage}
              totalPages={leadsMeta.totalPages}
              total={leadsMeta.total}
              onPageChange={setLeadPage}
            />
          </div>
        )}

        {tab === 'commission' && (
          <div className="space-y-4">
            {stats && (
              <div className="flex flex-wrap gap-3">
                <Badge className="bg-amber-600/30 text-amber-100">Pending: ₹{(stats.commissionPending ?? 0).toLocaleString('en-IN')}</Badge>
                <Badge className="bg-emerald-600/30 text-emerald-100">Paid: ₹{(stats.commissionPaid ?? stats.commissionReleased ?? 0).toLocaleString('en-IN')}</Badge>
              </div>
            )}
            <ListPagination
              label="Leads"
              page={leadPage}
              totalPages={leadsMeta.totalPages}
              total={leadsMeta.total}
              onPageChange={setLeadPage}
            />
            {leads.map((l) => (
              <Card key={l.id} className="border-white/10 bg-white/5">
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold">{l.leadId} · {l.clientName}</p>
                    <Badge variant="outline" className="border-white/20 capitalize">{l.status.replace(/_/g, ' ')}</Badge>
                  </div>
                  <LeadCommissionPanel
                    lead={l}
                    canEdit={canAccess(user, 'partner_network', 'edit')}
                    saving={updatingLeadId === l.id}
                    onSave={updateLead}
                  />
                </CardContent>
              </Card>
            ))}
            {!leads.length && <p className="text-slate-400">No leads with commission data yet.</p>}
            <ListPagination
              label="Leads"
              page={leadPage}
              totalPages={leadsMeta.totalPages}
              total={leadsMeta.total}
              onPageChange={setLeadPage}
            />
          </div>
        )}

        {tab === 'callbacks' && (
          <PartnerCallbackRequestsPanel canEdit={canAccess(user, 'partner_network', 'edit')} />
        )}

        {tab === 'activity' && (
          <Card className="border-white/10 bg-white/5">
            <CardContent className="space-y-4 p-4">
              <ListPagination
                label="Activity"
                page={activityPage}
                totalPages={activityMeta.totalPages}
                total={activityMeta.total}
                onPageChange={setActivityPage}
              />
              <div className="max-h-[28rem] space-y-2 overflow-y-auto">
                {activity.map((a) => (
                  <p key={a.id} className="text-sm text-slate-300">{new Date(a.createdAt).toLocaleString()} — {a.action} ({a.entityType})</p>
                ))}
                {!activity.length && <p className="text-slate-400">No activity logged yet.</p>}
              </div>
              <ListPagination
                label="Activity"
                page={activityPage}
                totalPages={activityMeta.totalPages}
                total={activityMeta.total}
                onPageChange={setActivityPage}
              />
            </CardContent>
          </Card>
        )}

        {tab === 'settings' && (
          <Card className="border-white/10 bg-white/5">
            <CardHeader><CardTitle>Trust Section Counters (Public /partner page)</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {Object.entries(counters).map(([key, value]) => (
                <div key={key}>
                  <label className="text-sm text-slate-400">{TRUST_COUNTER_LABELS[key]}</label>
                  <Input type="number" value={value} onChange={(e) => setCounters({ ...counters, [key]: Number(e.target.value) })} className="mt-1 bg-white/10 text-white" />
                </div>
              ))}
              <Button className="sm:col-span-2 bg-orange-600" onClick={saveCounters}>Save Counters</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
