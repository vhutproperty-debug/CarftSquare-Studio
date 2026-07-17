'use client';

import { useEffect, useState } from 'react';
import {
  CalendarClock,
  Download,
  Eye,
  FileText,
  FolderOpen,
  Grid3X3,
  Handshake,
  Home,
  ImagePlus,
  LockKeyhole,
  LogOut,
  MessageCircle,
  Palette,
  Paintbrush,
  Phone,
  RefreshCcw,
  Save,
  Send,
  SlidersHorizontal,
  Tag,
  Trash2,
  Upload,
  Users,
  Video,
  WalletCards,
  Wand2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BRAND } from '@/lib/brand';
import BrandLogo from '@/components/BrandLogo';
import CmsPanel from './CmsPanel';
import dynamic from 'next/dynamic';

const RbacManagementPanel = dynamic(() => import('./RbacManagementPanel'), {
  ssr: false,
  loading: () => null,
});
const ActivityLogsPanel = dynamic(() => import('./ActivityLogsPanel'), {
  ssr: false,
  loading: () => null,
});
import PermissionGate, { SuperAdminGate } from './PermissionGate';
import { isSafeOpsReturnTo } from '@/lib/auth/safe-ops-return-to';
import { canAccess, canAccessAny, isSuperAdmin } from '@/lib/auth/rbac/client';

function formatCurrency(value = 0) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

const AdminPage = () => {
  const [auth, setAuth] = useState({ checked: false, hasAdmin: false, authenticated: false, user: null });
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [adminLeads, setAdminLeads] = useState([]);
  const [adminVendors, setAdminVendors] = useState([]);
  const [adminDashboard, setAdminDashboard] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState('');
  const [wallColor, setWallColor] = useState('#f97316');
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [shadeImportText, setShadeImportText] = useState('');
  const [shadeImportMode, setShadeImportMode] = useState('upsert');
  const [mediaTab, setMediaTab] = useState('gallery');
  const [mediaItems, setMediaItems] = useState([]);
  const [mediaUploadForm, setMediaUploadForm] = useState({ title: '', category: 'painting', type: 'image', tags: '', altText: '', isHomeBanner: false, isFeatured: false });
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const [mediaMessage, setMediaMessage] = useState('');
  const [mediaLoading, setMediaLoading] = useState(false);
  const [testimonialForm, setTestimonialForm] = useState({ name: '', area: '', text: '', rating: 5 });
  const [testimonials, setTestimonials] = useState([]);
  const [testimonialMessage, setTestimonialMessage] = useState('');
  const [accessDenied, setAccessDenied] = useState('');

  async function loadAdminData(user) {
    try {
      const requests = [];
      const keys = [];

      if (canAccess(user, 'leads', 'view')) {
        requests.push(fetch('/api/admin/leads', { credentials: 'include' }));
        keys.push('leads');
      }
      if (canAccess(user, 'leads', 'view')) {
        requests.push(fetch('/api/admin/vendors', { credentials: 'include' }));
        keys.push('vendors');
      }
      if (canAccess(user, 'dashboard', 'view') || canAccess(user, 'analytics', 'view')) {
        requests.push(fetch('/api/admin/dashboard', { credentials: 'include' }));
        keys.push('dashboard');
      }
      if (canAccess(user, 'ai_quotes', 'view')) {
        requests.push(fetch('/api/admin/pricing', { credentials: 'include' }));
        keys.push('pricing');
      }

      if (!requests.length) return;

      const responses = await Promise.all(requests);
      const forbidden = responses.some((response) => response.status === 403);
      if (forbidden) {
        setAccessDenied('Access denied. You do not have permission to view one or more admin sections.');
        return;
      }

      const payload = await Promise.all(responses.map((response) => response.json().catch(() => ({}))));
      const dataByKey = Object.fromEntries(keys.map((key, index) => [key, payload[index]]));

      if (dataByKey.leads) setAdminLeads(dataByKey.leads.leads || []);
      if (dataByKey.vendors) setAdminVendors(dataByKey.vendors.vendors || []);
      if (dataByKey.dashboard) setAdminDashboard(dataByKey.dashboard || null);
      if (dataByKey.pricing) setPricing(dataByKey.pricing.pricing || null);
    } catch (error) {
      setMessage('Could not load admin data.');
    }
  }

  async function loadAuth() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch('/api/auth/status', {
        credentials: 'include',
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.error || 'Could not connect to the admin API. Check MongoDB in .env.local and restart the dev server.');
        return;
      }
      const user = data.user
        ? {
            ...data.user,
            role: data.role || data.user.role,
            isSuperAdmin: Boolean(data.isSuperAdmin ?? data.user.isSuperAdmin),
          }
        : null;
      setAuth({ checked: true, hasAdmin: Boolean(data.hasAdmin), authenticated: Boolean(data.authenticated), user });
      if (data.authenticated) {
        const returnTo = new URLSearchParams(window.location.search).get('returnTo');
        if (isSafeOpsReturnTo(returnTo)) {
          window.location.replace(returnTo);
          return;
        }
        loadAdminData(user);
      }
    } catch (error) {
      const timedOut = error?.name === 'AbortError';
      setMessage(timedOut
        ? 'Admin auth check timed out. Reload the page or continue using the public site.'
        : 'Could not reach the admin API. Make sure npm run dev is running.');
    } finally {
      clearTimeout(timer);
      setAuth((current) => ({ ...current, checked: true }));
    }
  }

  useEffect(() => {
    loadAuth();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('denied')) {
      setAccessDenied('Access denied. You do not have permission to view that section.');
    }
  }, []);

  async function submitAuth(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const endpoint = auth.hasAdmin ? '/api/auth/login' : '/api/auth/setup';
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Authentication failed');
      setMessage(data.message || 'Authenticated.');
      const returnTo = new URLSearchParams(window.location.search).get('returnTo');
      if (isSafeOpsReturnTo(returnTo)) {
        window.location.replace(returnTo);
        return;
      }
      await loadAuth();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setAuth({ checked: true, hasAdmin: true, authenticated: false, user: null });
    setAdminLeads([]);
    setAdminVendors([]);
    setAdminDashboard(null);
  }

  async function resetPassword(event) {
    event.preventDefault();
    setMessage('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not reset password');
      setMessage(data.message || 'Password reset successfully.');
      setNewPassword('');
      setResetOpen(false);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateLeadStatus(leadId, status) {
    setMessage('');
    const response = await fetch(`/api/admin/leads/${leadId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || 'Could not update lead');
      return;
    }
    setAdminLeads((current) => current.map((lead) => (lead.id === leadId ? data.lead : lead)));
    loadAdminData();
  }

  function updatePricingField(key, value) {
    setPricing((current) => ({ ...current, [key]: value }));
  }

  function updateQualityMultiplier(key, value) {
    setPricing((current) => ({
      ...current,
      qualityMultipliers: {
        ...(current?.qualityMultipliers || {}),
        [key]: Number(value),
      },
    }));
  }

  function updateService(index, key, value) {
    setPricing((current) => ({
      ...current,
      services: (current?.services || []).map((service, serviceIndex) => (
        serviceIndex === index ? { ...service, [key]: key === 'baseRate' ? Number(value) : value } : service
      )),
    }));
  }

  async function savePricing(event) {
    event.preventDefault();
    if (!pricing) return;
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/pricing', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pricing }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save pricing');
      setPricing(data.pricing);
      setMessage(data.message || 'Pricing settings saved.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function resetPricing() {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/pricing/reset', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not reset pricing');
      setPricing(data.pricing);
      setMessage(data.message || 'Pricing reset to defaults.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateVendorStatus(vendorId, status) {
    setMessage('');
    const response = await fetch(`/api/admin/vendors/${vendorId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || 'Could not update vendor');
      return;
    }
    setAdminVendors((current) => current.map((vendor) => (vendor.id === vendorId ? data.vendor : vendor)));
    setMessage(data.message || 'Vendor request updated.');
  }

  async function assignLeadVendor(leadId, assignedVendor) {
    setMessage('');
    const response = await fetch(`/api/admin/leads/${leadId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignedVendor }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || 'Could not assign vendor');
      return;
    }
    setAdminLeads((current) => current.map((lead) => (lead.id === leadId ? data.lead : lead)));
    setMessage('Vendor assigned to lead.');
  }

  function parseShadeImport(text) {
    const trimmed = text.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      return JSON.parse(trimmed);
    }
    const lines = trimmed.split(/\r?\n/).filter(Boolean);
    const headers = lines.shift().split(',').map((header) => header.trim());
    return lines.map((line) => {
      const values = line.split(',').map((value) => value.trim());
      return headers.reduce((acc, header, index) => ({ ...acc, [header]: values[index] || '' }), {});
    });
  }

  async function importShades(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const shades = parseShadeImport(shadeImportText);
      const response = await fetch('/api/admin/shades/import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: shadeImportMode, shades }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not import shades');
      setMessage(data.message || 'Paint shades imported successfully.');
      setShadeImportText('');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function sendWhatsApp(leadId) {
    setMessage('');
    const response = await fetch('/api/admin/whatsapp/send', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId }),
    });
    const data = await response.json();
    setMessage(response.ok ? 'WhatsApp automation sent.' : data.error || 'WhatsApp automation unavailable.');
  }

  async function testAiVisualizer() {
    setMessage('');
    const response = await fetch('/api/visualizer/transform', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallColor }),
    });
    const data = await response.json();
    setMessage(response.ok ? data.message : data.error || 'AI visualizer unavailable.');
  }

  function onRoomImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (readerEvent) => setPreview(String(readerEvent.target?.result || ''));
    reader.readAsDataURL(file);
  }

  const stats = adminDashboard?.stats || {};
  const approvedVendors = adminVendors.filter((vendor) => vendor.status === 'approved');

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-950 text-white">
      <nav className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-3">
          <a href="/" className="flex items-center gap-3">
            <BrandLogo variant="compact" />
            <span className="text-sm font-black tracking-tight sm:text-lg">Admin</span>
          </a>
          <div className="flex items-center gap-2">
            {auth.authenticated && canAccess(auth.user, 'ai_quotes', 'view') && (
              <a href="/admin/quotation">
                <Button variant="outline" className="border-white/20 bg-white/10 px-3 text-white hover:bg-white/20 sm:px-4"><WalletCards className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">AI Quotations</span></Button>
              </a>
            )}
            {auth.authenticated && canAccess(auth.user, 'blog', 'view') && (
              <a href="/admin/blog">
                <Button variant="outline" className="border-white/20 bg-white/10 px-3 text-white hover:bg-white/20 sm:px-4"><FileText className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Blogs</span></Button>
              </a>
            )}
            {auth.authenticated && canAccess(auth.user, 'partner_network', 'view') && (
              <a href="/admin/partner-network">
                <Button variant="outline" className="border-white/20 bg-white/10 px-3 text-white hover:bg-white/20 sm:px-4"><Handshake className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Partners</span></Button>
              </a>
            )}
            {auth.authenticated && (canAccess(auth.user, 'painting', 'view') || canAccess(auth.user, 'leads', 'view')) && (
              <a href="/admin/painting">
                <Button variant="outline" className="border-white/20 bg-white/10 px-3 text-white hover:bg-white/20 sm:px-4"><Paintbrush className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Painting</span></Button>
              </a>
            )}
            <a href="/">
              <Button variant="outline" className="border-white/20 bg-white/10 px-3 text-white hover:bg-white/20 sm:px-4"><Home className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Public Site</span></Button>
            </a>
          </div>
        </div>
      </nav>

      <section className="container py-14">
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <Badge className="mb-4 bg-orange-500 text-white hover:bg-orange-500">Private admin area</Badge>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl md:text-6xl">CRM-ready backend for leads, quotes and project tracking</h1>
          <p className="mt-4 text-slate-300">Private admin tools for lead management, quote PDFs, project statuses, WhatsApp automation hooks and visualizer workflows.</p>
        </div>

        {!auth.checked ? (
          <Card className="mx-auto max-w-xl border-white/10 bg-white/10 text-white backdrop-blur"><CardContent className="p-8">Checking admin session...</CardContent></Card>
        ) : !auth.authenticated ? (
          <Card className="mx-auto max-w-xl border-0 bg-white text-slate-950 shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-orange-600" /> {auth.hasAdmin ? 'Admin Login' : 'Create First Admin'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitAuth} className="grid gap-4">
                {!auth.hasAdmin && <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Admin name" />}
                <Input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder={`admin@${BRAND.domain}`} required />
                <Input type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="Password" required />
                <Button disabled={loading} className="bg-orange-600 font-black text-white hover:bg-orange-700">{loading ? 'Please wait...' : auth.hasAdmin ? 'Login to Admin' : 'Create Admin'}</Button>
                {message && <p className="text-sm font-semibold text-orange-600">{message}</p>}
              </form>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card className="border-white/10 bg-white/10 text-white backdrop-blur">
              <CardContent className="space-y-4 p-6">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-sm text-slate-300">Logged in as</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-black">{auth.user?.name || auth.user?.email}</h2>
                      <Badge className={isSuperAdmin(auth.user) ? 'bg-purple-500 text-white hover:bg-purple-500' : 'bg-orange-500 text-white hover:bg-orange-500'}>
                        {isSuperAdmin(auth.user) ? 'Super Admin' : 'Admin'}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-400">{auth.user?.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => setResetOpen((current) => !current)} variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20"><LockKeyhole className="mr-2 h-4 w-4" /> Reset Password</Button>
                    <Button onClick={logout} variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20"><LogOut className="mr-2 h-4 w-4" /> Logout</Button>
                  </div>
                </div>
                {resetOpen && (
                  <form onSubmit={resetPassword} className="grid gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 sm:grid-cols-[1fr_auto]">
                    <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Enter new password" minLength={8} required className="bg-white text-slate-950" />
                    <Button disabled={loading} className="bg-orange-600 font-black text-white hover:bg-orange-700">Save Password</Button>
                  </form>
                )}
                {accessDenied && <p className="rounded-2xl bg-red-500/15 p-4 text-sm font-semibold text-red-200">{accessDenied}</p>}
                {message && <p className="rounded-2xl bg-orange-50 p-4 text-sm font-semibold text-orange-700">{message}</p>}
              </CardContent>
            </Card>

            <SuperAdminGate user={auth.user}>
              <RbacManagementPanel currentUser={auth.user} onMessage={setMessage} />
              <ActivityLogsPanel currentUser={auth.user} onMessage={setMessage} />
            </SuperAdminGate>

          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6">
              <PermissionGate user={auth.user} module="dashboard" action="view">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {[
                  ['Leads', stats.totalLeads || adminLeads.length, Users],
                  ['New', stats.newLeads || 0, Phone],
                  ['Scheduled', stats.scheduled || 0, CalendarClock],
                  ['Vendors', adminVendors.length, Users],
                  ['Revenue', formatCurrency(stats.potentialRevenue || 0), WalletCards],
                ].map(([label, value, Icon]) => (
                  <Card key={label} className="border-white/10 bg-white/10 text-white backdrop-blur">
                    <CardContent className="p-4"><Icon className="h-5 w-5 text-orange-300" /><p className="mt-3 text-xs text-slate-300">{label}</p><p className="text-xl font-black">{value}</p></CardContent>
                  </Card>
                ))}
              </div>
              </PermissionGate>

              <PermissionGate user={auth.user} module="ai_quotes" action="view">
              <Card className="border-white/10 bg-white text-slate-950">
                <CardHeader>
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <CardTitle className="flex items-center gap-2"><SlidersHorizontal className="h-5 w-5 text-orange-600" /> Pricing Settings + Service Management</CardTitle>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => setPricingOpen((current) => !current)}>{pricingOpen ? 'Hide' : 'Edit Pricing'}</Button>
                      <Button type="button" variant="outline" onClick={resetPricing} disabled={loading}><RefreshCcw className="mr-2 h-4 w-4" /> Reset Defaults</Button>
                    </div>
                  </div>
                </CardHeader>
                {pricingOpen && pricing && (
                  <CardContent>
                    <form onSubmit={savePricing} className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-4">
                        {Object.entries(pricing.qualityMultipliers || {}).map(([key, value]) => (
                          <label key={key} className="space-y-2 text-sm font-bold capitalize">
                            {key} multiplier
                            <Input type="number" step="0.01" value={value} onChange={(event) => updateQualityMultiplier(key, event.target.value)} />
                          </label>
                        ))}
                        <label className="space-y-2 text-sm font-bold">Fresh multiplier<Input type="number" step="0.01" value={pricing.freshMultiplier || 1} onChange={(event) => updatePricingField('freshMultiplier', Number(event.target.value))} /></label>
                        <label className="space-y-2 text-sm font-bold">Material %<Input type="number" value={pricing.materialPercent || 0} onChange={(event) => updatePricingField('materialPercent', Number(event.target.value))} /></label>
                        <label className="space-y-2 text-sm font-bold">Labor %<Input type="number" value={pricing.laborPercent || 0} onChange={(event) => updatePricingField('laborPercent', Number(event.target.value))} /></label>
                        <label className="space-y-2 text-sm font-bold">Repaint sqft/day<Input type="number" value={pricing.repaintSqftPerDay || 1} onChange={(event) => updatePricingField('repaintSqftPerDay', Number(event.target.value))} /></label>
                        <label className="space-y-2 text-sm font-bold">Fresh sqft/day<Input type="number" value={pricing.freshSqftPerDay || 1} onChange={(event) => updatePricingField('freshSqftPerDay', Number(event.target.value))} /></label>
                      </div>

                      <div className="grid gap-3">
                        {(pricing.services || []).map((service, index) => (
                          <div key={service.id} className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 lg:grid-cols-[120px_1fr_1fr_1fr_110px]">
                            <label className="flex items-center gap-2 text-sm font-bold">
                              <input type="checkbox" checked={service.active !== false} onChange={(event) => updateService(index, 'active', event.target.checked)} /> Active
                            </label>
                            <Input value={service.title || ''} onChange={(event) => updateService(index, 'title', event.target.value)} placeholder="Service title" />
                            <Input type="number" value={service.baseRate || 0} onChange={(event) => updateService(index, 'baseRate', event.target.value)} placeholder="Rate / sq.ft" />
                            <Input value={service.price || ''} onChange={(event) => updateService(index, 'price', event.target.value)} placeholder="Public price label" />
                            <span className="rounded-md bg-white px-3 py-2 text-xs font-black text-slate-500">{service.id}</span>
                            <textarea value={service.description || ''} onChange={(event) => updateService(index, 'description', event.target.value)} placeholder="Service description" className="min-h-[76px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm lg:col-span-5" />
                          </div>
                        ))}
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <textarea value={pricing.standardWarranty || ''} onChange={(event) => updatePricingField('standardWarranty', event.target.value)} className="min-h-[84px] rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Standard warranty text" />
                        <textarea value={pricing.waterproofingWarranty || ''} onChange={(event) => updatePricingField('waterproofingWarranty', event.target.value)} className="min-h-[84px] rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Waterproofing warranty text" />
                      </div>

                      <Button disabled={loading} className="bg-orange-600 font-black text-white hover:bg-orange-700"><Save className="mr-2 h-4 w-4" /> Save Pricing Settings</Button>
                    </form>
                  </CardContent>
                )}
              </Card>
              </PermissionGate>


              {canAccessAny(auth.user, ['projects', 'gallery', 'marketing'], 'view') && (
                <CmsPanel onMessage={setMessage} user={auth.user} />
              )}

              <PermissionGate user={auth.user} module="leads" action="view">
              <Card className="border-white/10 bg-white text-slate-950">
                <CardHeader><CardTitle>Secure lead management</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-slate-700">
                    <p className="font-bold text-slate-900">Painting landing leads are separate</p>
                    <p className="mt-1">Submissions from <a href="/painting" className="font-semibold text-orange-700 hover:underline">/painting</a> are stored in the <strong>painting_leads</strong> collection — not in this list.</p>
                    <a href="/admin/painting" className="mt-3 inline-flex">
                      <Button className="bg-orange-600 font-bold text-white hover:bg-orange-700">
                        <Paintbrush className="mr-2 h-4 w-4" /> Open Painting Leads
                      </Button>
                    </a>
                  </div>
                  {adminLeads.length ? adminLeads.slice(0, 12).map((lead) => (
                    <div key={lead.id} className="grid gap-3 rounded-2xl border border-slate-100 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                      <div className="min-w-0">
                        <p className="break-words font-black">{lead.name} • {lead.location || 'Mumbai'}</p>
                        <p className="break-words text-sm text-slate-500">{lead.phone} · {lead.service} · {lead.estimate?.formattedRange}</p>
                        <p className="mt-1 break-words text-xs font-bold text-slate-500">Assigned vendor: {lead.assignedVendor || 'Not assigned'}</p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap">
                        <select value={lead.status} onChange={(event) => updateLeadStatus(lead.id, event.target.value)} className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-bold lg:w-auto">
                          <option value="new">New</option>
                          <option value="scheduled">Scheduled</option>
                          <option value="quoted">Quoted</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                        <select value={lead.assignedVendor || ''} onChange={(event) => assignLeadVendor(lead.id, event.target.value)} className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-bold lg:w-auto">
                          <option value="">Assign vendor</option>
                          {approvedVendors.map((vendor) => <option key={vendor.id} value={vendor.name}>{vendor.name}</option>)}
                        </select>
                        <a href={`/api/admin/quote/${lead.id}/pdf`} target="_blank" rel="noreferrer"><Button variant="outline" className="w-full font-bold lg:w-auto"><Download className="mr-2 h-4 w-4" /> PDF</Button></a>
                        <Button onClick={() => sendWhatsApp(lead.id)} className="w-full bg-emerald-600 font-bold hover:bg-emerald-700 lg:w-auto"><Send className="mr-2 h-4 w-4" /> WhatsApp</Button>
                      </div>
                    </div>
                  )) : <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">No leads yet. Submit a quote form on the public site to manage it here.</p>}
                </CardContent>
              </Card>
              </PermissionGate>

              <PermissionGate user={auth.user} module="leads" action="view">
              <Card className="border-white/10 bg-white text-slate-950">
                <CardHeader><CardTitle>Vendor association requests</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {adminVendors.length ? adminVendors.map((vendor) => (
                    <div key={vendor.id} className="grid gap-3 rounded-2xl border border-slate-100 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                      <div className="min-w-0">
                        <p className="break-words font-black">{vendor.name} • {vendor.cityArea}</p>
                        <p className="break-words text-sm text-slate-500">{vendor.phone} · {vendor.email || 'No email'} · {vendor.yearsExperience} yrs · Team {vendor.teamSize}</p>
                        <p className="mt-1 break-words text-xs text-slate-500">Services: {(vendor.servicesOffered || []).join(', ')}</p>
                        {vendor.gstPan && <p className="mt-1 break-words text-xs text-slate-500">GST/PAN: {vendor.gstPan}</p>}
                        {vendor.portfolioNotes && <p className="mt-2 break-words text-sm text-slate-600">{vendor.portfolioNotes}</p>}
                      </div>
                      <select value={vendor.status} onChange={(event) => updateVendorStatus(vendor.id, event.target.value)} className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-bold lg:w-auto">
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                  )) : <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">No vendor requests yet. Contractors can submit from the public website section.</p>}
                </CardContent>
              </Card>
              </PermissionGate>

              <PermissionGate user={auth.user} module="gallery" action="view">
              <Card className="border-white/10 bg-white text-slate-950">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImagePlus className="h-5 w-5 text-orange-600" /> Media Management
                  </CardTitle>
                  <p className="text-sm text-slate-500">Upload project photos, videos, before/after images, banners and manage gallery dynamically.</p>
                </CardHeader>
                <CardContent>
                  {/* Tabs */}
                  <div className="flex gap-2 mb-6 flex-wrap border-b border-slate-100 pb-3">
                    {[
                      { id: 'gallery', label: 'Gallery', icon: Grid3X3 },
                      { id: 'upload', label: 'Upload Media', icon: Upload },
                      { id: 'banners', label: 'Banners', icon: FolderOpen },
                      { id: 'testimonials', label: 'Testimonials', icon: Tag },
                    ].map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setMediaTab(tab.id)}
                          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${mediaTab === tab.id ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                          <Icon className="h-4 w-4" /> {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Upload Tab */}
                  {mediaTab === 'upload' && (
                    <div className="space-y-5">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Media Title</label>
                          <input
                            value={mediaUploadForm.title}
                            onChange={(e) => setMediaUploadForm(f => ({ ...f, title: e.target.value }))}
                            placeholder="e.g. 3BHK Kitchen Renovation - Andheri"
                            className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Category</label>
                          <select
                            value={mediaUploadForm.category}
                            onChange={(e) => setMediaUploadForm(f => ({ ...f, category: e.target.value }))}
                            className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm font-medium"
                          >
                            <option value="painting">Painting</option>
                            <option value="modular-kitchen">Modular Kitchen</option>
                            <option value="wardrobes">Wardrobes</option>
                            <option value="interior">Interiors</option>
                            <option value="waterproofing">Waterproofing</option>
                            <option value="texture">Texture Design</option>
                            <option value="before-after">Before & After</option>
                            <option value="banner">Homepage Banner</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Media Type</label>
                          <select
                            value={mediaUploadForm.type}
                            onChange={(e) => setMediaUploadForm(f => ({ ...f, type: e.target.value }))}
                            className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm font-medium"
                          >
                            <option value="image">Image / Photo</option>
                            <option value="video">Video</option>
                            <option value="before-after">Before & After</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-widest text-slate-500">SEO Tags (comma separated)</label>
                          <input
                            value={mediaUploadForm.tags}
                            onChange={(e) => setMediaUploadForm(f => ({ ...f, tags: e.target.value }))}
                            placeholder="e.g. modular kitchen, andheri, L-shaped"
                            className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm"
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Alt Text (SEO)</label>
                          <input
                            value={mediaUploadForm.altText}
                            onChange={(e) => setMediaUploadForm(f => ({ ...f, altText: e.target.value }))}
                            placeholder="e.g. Modular L-shaped kitchen with acrylic finish in Andheri apartment"
                            className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex gap-6">
                        <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={mediaUploadForm.isHomeBanner}
                            onChange={(e) => setMediaUploadForm(f => ({ ...f, isHomeBanner: e.target.checked }))}
                            className="h-4 w-4 rounded"
                          />
                          Use as Homepage Banner
                        </label>
                        <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={mediaUploadForm.isFeatured}
                            onChange={(e) => setMediaUploadForm(f => ({ ...f, isFeatured: e.target.checked }))}
                            className="h-4 w-4 rounded"
                          />
                          Featured in Gallery
                        </label>
                      </div>

                      {/* Drag & drop upload zone */}
                      <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-orange-200 bg-orange-50 p-10 text-center hover:border-orange-400 hover:bg-orange-100 transition-colors">
                        {mediaUploadForm.type === 'video' ? <Video className="h-10 w-10 text-orange-400" /> : <ImagePlus className="h-10 w-10 text-orange-400" />}
                        <div>
                          <p className="font-black text-slate-950">
                            {mediaFile ? mediaFile.name : 'Drag & drop or click to upload'}
                          </p>
                          <p className="text-sm text-slate-500 mt-1">
                            {mediaUploadForm.type === 'video' ? 'MP4, MOV, WebM up to 100MB' : 'JPG, PNG, WebP up to 10MB each'}
                          </p>
                        </div>
                        <input
                          type="file"
                          accept={mediaUploadForm.type === 'video' ? 'video/*' : 'image/*'}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setMediaFile(file);
                            if (file.type.startsWith('image/')) {
                              const reader = new FileReader();
                              reader.onload = (re) => setMediaPreview(String(re.target?.result || ''));
                              reader.readAsDataURL(file);
                            } else {
                              setMediaPreview('');
                            }
                          }}
                        />
                      </label>

                      {mediaPreview && (
                        <div className="relative h-48 overflow-hidden rounded-2xl">
                          <img src={mediaPreview} alt="Preview" className="h-full w-full object-cover" />
                          <div className="absolute top-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-black">Preview</div>
                        </div>
                      )}

                      <div className="flex items-center gap-4">
                        <Button
                          disabled={mediaLoading || !mediaFile}
                          onClick={async () => {
                            if (!mediaFile) return;
                            setMediaLoading(true);
                            setMediaMessage('');
                            try {
                              // In production, this would upload to cloud storage
                              // Here we simulate adding to gallery with a local object URL
                              const url = URL.createObjectURL(mediaFile);
                              const newItem = {
                                id: Date.now().toString(),
                                url,
                                title: mediaUploadForm.title || mediaFile.name,
                                category: mediaUploadForm.category,
                                type: mediaUploadForm.type,
                                tags: mediaUploadForm.tags.split(',').map(t => t.trim()).filter(Boolean),
                                altText: mediaUploadForm.altText,
                                isHomeBanner: mediaUploadForm.isHomeBanner,
                                isFeatured: mediaUploadForm.isFeatured,
                                uploadedAt: new Date().toLocaleDateString(),
                              };
                              setMediaItems(prev => [newItem, ...prev]);
                              setMediaMessage('✓ Media uploaded successfully to gallery.');
                              setMediaFile(null);
                              setMediaPreview('');
                              setMediaUploadForm({ title: '', category: 'painting', type: 'image', tags: '', altText: '', isHomeBanner: false, isFeatured: false });
                              setMediaTab('gallery');
                            } catch (err) {
                              setMediaMessage('Upload failed. Please try again.');
                            } finally {
                              setMediaLoading(false);
                            }
                          }}
                          className="bg-orange-600 font-black text-white hover:bg-orange-700"
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          {mediaLoading ? 'Uploading...' : 'Upload Media'}
                        </Button>
                        {mediaFile && (
                          <button
                            onClick={() => { setMediaFile(null); setMediaPreview(''); }}
                            className="text-sm text-slate-500 hover:text-red-600 flex items-center gap-1"
                          >
                            <X className="h-4 w-4" /> Clear
                          </button>
                        )}
                      </div>
                      {mediaMessage && <p className={`text-sm font-semibold ${mediaMessage.startsWith('✓') ? 'text-emerald-600' : 'text-red-600'}`}>{mediaMessage}</p>}

                      <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                        <p className="font-bold text-slate-950 mb-2">Production setup required:</p>
                        <p>Connect AWS S3, Cloudinary, or Google Cloud Storage by adding the relevant API keys to environment variables. Images will then be uploaded, optimized, and served via CDN automatically.</p>
                      </div>
                    </div>
                  )}

                  {/* Gallery Tab */}
                  {mediaTab === 'gallery' && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {['All', 'painting', 'modular-kitchen', 'wardrobes', 'interior', 'before-after', 'banner'].map((cat) => (
                          <button key={cat} className="rounded-full bg-slate-100 px-4 py-1.5 text-xs font-bold text-slate-600 capitalize hover:bg-orange-100 hover:text-orange-700 transition">
                            {cat === 'All' ? 'All Media' : cat.replace('-', ' ')}
                          </button>
                        ))}
                      </div>
                      {mediaItems.length === 0 ? (
                        <div className="rounded-3xl border-2 border-dashed border-slate-200 p-12 text-center">
                          <ImagePlus className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                          <p className="font-black text-slate-950">No media uploaded yet</p>
                          <p className="text-sm text-slate-500 mt-2">Upload project photos, before/after images, and banners from the Upload tab.</p>
                          <button onClick={() => setMediaTab('upload')} className="mt-4 rounded-full bg-orange-600 px-6 py-2 text-sm font-black text-white hover:bg-orange-700">
                            Upload First Media
                          </button>
                        </div>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {mediaItems.map((item) => (
                            <div key={item.id} className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                              {item.type === 'video' ? (
                                <div className="flex h-48 items-center justify-center bg-slate-950">
                                  <Video className="h-10 w-10 text-orange-400" />
                                </div>
                              ) : (
                                <img src={item.url} alt={item.altText || item.title} className="h-48 w-full object-cover" />
                              )}
                              <div className="p-3">
                                <p className="font-black text-sm text-slate-950 truncate">{item.title}</p>
                                <p className="text-xs text-slate-500 capitalize mt-1">{item.category.replace('-', ' ')} • {item.uploadedAt}</p>
                                <div className="flex gap-2 mt-2 flex-wrap">
                                  {item.isHomeBanner && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">Banner</span>}
                                  {item.isFeatured && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">Featured</span>}
                                </div>
                              </div>
                              <button
                                onClick={() => setMediaItems(prev => prev.filter(m => m.id !== item.id))}
                                className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Banners Tab */}
                  {mediaTab === 'banners' && (
                    <div className="space-y-4">
                      <p className="text-sm text-slate-600">Manage homepage banners and featured images. Mark any uploaded image as a banner from the Upload tab.</p>
                      {mediaItems.filter(m => m.isHomeBanner).length === 0 ? (
                        <div className="rounded-3xl border-2 border-dashed border-slate-200 p-10 text-center">
                          <FolderOpen className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                          <p className="font-black text-slate-950">No banners configured</p>
                          <p className="text-sm text-slate-500 mt-1">Upload images and check &quot;Use as Homepage Banner&quot; to add them here.</p>
                        </div>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2">
                          {mediaItems.filter(m => m.isHomeBanner).map((item) => (
                            <div key={item.id} className="overflow-hidden rounded-2xl border border-orange-100">
                              <img src={item.url} alt={item.altText} className="h-40 w-full object-cover" />
                              <div className="p-3 flex justify-between items-center">
                                <p className="text-sm font-black">{item.title}</p>
                                <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">Active Banner</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Testimonials Tab */}
                  {mediaTab === 'testimonials' && (
                    <div className="space-y-6">
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                        <h4 className="font-black text-slate-950 mb-4">Add New Testimonial</h4>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Customer Name</label>
                            <input
                              value={testimonialForm.name}
                              onChange={(e) => setTestimonialForm(f => ({ ...f, name: e.target.value }))}
                              placeholder="e.g. Priya Kapoor"
                              className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Area / Location</label>
                            <input
                              value={testimonialForm.area}
                              onChange={(e) => setTestimonialForm(f => ({ ...f, area: e.target.value }))}
                              placeholder="e.g. Juhu, Mumbai"
                              className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Rating</label>
                            <select
                              value={testimonialForm.rating}
                              onChange={(e) => setTestimonialForm(f => ({ ...f, rating: Number(e.target.value) }))}
                              className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium"
                            >
                              {[5, 4, 3, 2, 1].map(r => <option key={r} value={r}>{r} ★</option>)}
                            </select>
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Review Text</label>
                            <textarea
                              value={testimonialForm.text}
                              onChange={(e) => setTestimonialForm(f => ({ ...f, text: e.target.value }))}
                              placeholder="Customer's review about their painting, kitchen, or wardrobe project..."
                              className="min-h-[100px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                            />
                          </div>
                        </div>
                        <Button
                          className="mt-4 bg-orange-600 font-black text-white hover:bg-orange-700"
                          onClick={() => {
                            if (!testimonialForm.name || !testimonialForm.text) {
                              setTestimonialMessage('Name and review text are required.');
                              return;
                            }
                            setTestimonials(prev => [{ ...testimonialForm, id: Date.now().toString(), addedAt: new Date().toLocaleDateString() }, ...prev]);
                            setTestimonialForm({ name: '', area: '', text: '', rating: 5 });
                            setTestimonialMessage('✓ Testimonial added successfully.');
                          }}
                        >
                          Add Testimonial
                        </Button>
                        {testimonialMessage && <p className={`mt-3 text-sm font-semibold ${testimonialMessage.startsWith('✓') ? 'text-emerald-600' : 'text-red-600'}`}>{testimonialMessage}</p>}
                      </div>

                      <div className="space-y-3">
                        <h4 className="font-black text-slate-950">Saved Testimonials</h4>
                        {testimonials.length === 0 ? (
                          <p className="text-sm text-slate-500 rounded-2xl border border-dashed border-slate-200 p-6 text-center">No testimonials added yet. Add your first customer review above.</p>
                        ) : (
                          testimonials.map((t) => (
                            <div key={t.id} className="rounded-2xl border border-slate-100 bg-white p-4">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-black text-slate-950">{t.name} — {t.area}</p>
                                  <p className="text-orange-500 text-sm">{'★'.repeat(t.rating)}</p>
                                  <p className="mt-2 text-sm text-slate-600">&quot;{t.text}&quot;</p>
                                </div>
                                <button onClick={() => setTestimonials(prev => prev.filter(x => x.id !== t.id))} className="text-red-400 hover:text-red-600">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              </PermissionGate>

              <PermissionGate user={auth.user} module="marketing" action="view">
              <Card className="border-white/10 bg-white text-slate-950">
                <CardHeader><CardTitle>Paint Shade Import</CardTitle></CardHeader>
                <CardContent>
                  <form onSubmit={importShades} className="space-y-4">
                    <p className="text-sm leading-6 text-slate-600">Paste CSV or JSON with columns: shadeName, shadeCode, hexColor, brand, category. Imported shades populate the public Paint Shade Explorer.</p>
                    <div className="flex flex-wrap gap-3">
                      <select value={shadeImportMode} onChange={(event) => setShadeImportMode(event.target.value)} className="h-10 rounded-md border border-slate-200 px-3 text-sm font-bold">
                        <option value="upsert">Add / update existing</option>
                        <option value="replace">Replace all shades</option>
                      </select>
                      <a href="/shade-explorer" target="_blank" rel="noreferrer"><Button type="button" variant="outline">Open Shade Explorer</Button></a>
                    </div>
                    <textarea value={shadeImportText} onChange={(event) => setShadeImportText(event.target.value)} className="min-h-[180px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-mono" placeholder={'shadeName,shadeCode,hexColor,brand,category\nIvory Palace,AP-WH-101,#F4EFE3,Asian Paints,Whites'} />
                    <Button disabled={loading} className="bg-orange-600 font-black text-white hover:bg-orange-700"><Upload className="mr-2 h-4 w-4" /> Import Shades</Button>
                  </form>
                </CardContent>
              </Card>
              </PermissionGate>

            </div>

            <div className="space-y-6">
              <PermissionGate user={auth.user} module="marketing" action="view">
              <Card className="border-white/10 bg-white/10 text-white backdrop-blur">
                <CardHeader><CardTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5 text-orange-300" /> Room color visualizer</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-white/20 bg-white/10 p-6 text-center">
                    <Upload className="mb-3 h-8 w-8 text-orange-300" />
                    <span className="font-black">Upload room photo</span>
                    <span className="text-sm text-slate-300">Local color overlay preview works now</span>
                    <input type="file" accept="image/*" className="hidden" onChange={onRoomImage} />
                  </label>
                  {preview && (
                    <div className="relative h-64 overflow-hidden rounded-3xl bg-slate-900">
                      <img src={preview} alt="Room visualizer preview" className="h-full w-full object-cover" />
                      <div className="absolute inset-0 opacity-35 mix-blend-multiply" style={{ backgroundColor: wallColor }} />
                      <div className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-slate-950"><Eye className="mr-1 inline h-3 w-3" /> Overlay preview</div>
                    </div>
                  )}
                  <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-4">
                    <Palette className="h-5 w-5 text-orange-300" />
                    <input type="color" value={wallColor} onChange={(event) => setWallColor(event.target.value)} className="h-10 w-16 rounded" />
                    <span className="text-sm text-slate-300">Choose wall color</span>
                  </div>
                  <Button onClick={testAiVisualizer} variant="outline" className="w-full border-white/20 bg-white/10 font-black text-white hover:bg-white/20">Check AI visualizer integration</Button>
                  <p className="text-xs leading-5 text-slate-400">Real AI transformation will activate after adding STABILITY_API_KEY or CLARIFAI_API_KEY. Current preview is a local overlay, not an AI-generated render.</p>
                </CardContent>
              </Card>
              </PermissionGate>
              <PermissionGate user={auth.user} module="marketing" action="view">
              <Card className="border-white/10 bg-orange-500 text-white">
                <CardContent className="p-6">
                  <MessageCircle className="h-8 w-8" />
                  <h3 className="mt-4 text-2xl font-black">WhatsApp Business API ready</h3>
                  <p className="mt-2 text-sm text-orange-50">The admin action will send real estimate messages through Meta Cloud API once WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN are configured.</p>
                </CardContent>
              </Card>
              </PermissionGate>
            </div>
          </div>
          </div>
        )}
      </section>
    </main>
  );
};

export default AdminPage;
