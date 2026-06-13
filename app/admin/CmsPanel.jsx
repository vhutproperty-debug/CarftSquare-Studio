'use client';

import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  FileText,
  FolderOpen,
  Home,
  ImagePlus,
  Plus,
  Save,
  Trash2,
  Upload,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { canAccess } from '@/lib/auth/rbac/client';

function Field({ label, children }) {
  return (
    <label className="block space-y-2 text-sm font-bold">
      {label}
      {children}
    </label>
  );
}

function TextArea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
    />
  );
}

export default function CmsPanel({ onMessage, user }) {
  const [tab, setTab] = useState('about');
  const [loading, setLoading] = useState(false);
  const [about, setAbout] = useState(null);
  const [services, setServices] = useState([]);
  const [serviceForm, setServiceForm] = useState(null);
  const [rental, setRental] = useState(null);
  const [gallery, setGallery] = useState({ items: [], categories: [] });
  const [galleryForm, setGalleryForm] = useState(null);
  const [seo, setSeo] = useState(null);

  async function loadCms() {
    try {
      const [aboutRes, servicesRes, rentalRes, galleryRes, seoRes] = await Promise.all([
        fetch('/api/admin/about', { credentials: 'include' }),
        fetch('/api/admin/services', { credentials: 'include' }),
        fetch('/api/admin/rental-interiors', { credentials: 'include' }),
        fetch('/api/admin/gallery', { credentials: 'include' }),
        fetch('/api/admin/seo', { credentials: 'include' }),
      ]);
      if (aboutRes.ok) setAbout((await aboutRes.json()).about);
      if (servicesRes.ok) setServices((await servicesRes.json()).services || []);
      if (rentalRes.ok) setRental((await rentalRes.json()).service);
      if (galleryRes.ok) {
        const data = await galleryRes.json();
        setGallery({ items: data.items || [], categories: data.categories || [] });
      }
      if (seoRes.ok) setSeo((await seoRes.json()).seo);
    } catch {
      onMessage?.('Could not load CMS data.');
    }
  }

  useEffect(() => { loadCms(); }, []);

  async function save(endpoint, body, label) {
    setLoading(true);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Could not save ${label}`);
      onMessage?.(data.message || `${label} saved.`);
      await loadCms();
    } catch (error) {
      onMessage?.(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function uploadFile(file, onUrl) {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setLoading(true);
    try {
      const response = await fetch('/api/admin/media/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Upload failed');
      onUrl(data.url);
      onMessage?.('File uploaded.');
    } catch (error) {
      onMessage?.(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteItem(endpoint, label) {
    if (!window.confirm(`Delete this ${label}?`)) return;
    setLoading(true);
    try {
      const response = await fetch(endpoint, { method: 'DELETE', credentials: 'include' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Delete failed');
      onMessage?.(data.message || 'Deleted.');
      await loadCms();
    } catch (error) {
      onMessage?.(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function reorderServices(index, direction) {
    const next = [...services];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setServices(next);
    await save('/api/admin/services/reorder', { order: next.map((s) => s.id) }, 'order');
  }

  const tabs = [
    { id: 'about', label: 'About Us', icon: Home, module: 'projects' },
    { id: 'services', label: 'Services', icon: FolderOpen, module: 'projects' },
    { id: 'rental', label: 'Rental Interiors', icon: Home, module: 'projects' },
    { id: 'gallery', label: 'Gallery', icon: ImagePlus, module: 'gallery' },
    { id: 'seo', label: 'SEO', icon: FileText, module: 'marketing' },
  ].filter((item) => canAccess(user, item.module, 'view'));

  return (
    <Card className="border-white/10 bg-white text-slate-950">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-orange-600" /> Content Management (CMS)
        </CardTitle>
        <p className="text-sm text-slate-500">Manage About Us, Services, Rental Interiors, Gallery and SEO without code changes.</p>
        <div className="flex flex-wrap gap-2 pt-2">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${tab === t.id ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {tab === 'about' && about && (
          <form onSubmit={(e) => { e.preventDefault(); save('/api/admin/about', { about }, 'About content'); }} className="space-y-4">
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={about.enabled !== false} onChange={(e) => setAbout({ ...about, enabled: e.target.checked })} /> Enable About section on homepage
            </label>
            <Field label="Homepage eyebrow"><Input value={about.homepageEyebrow || ''} onChange={(e) => setAbout({ ...about, homepageEyebrow: e.target.value })} /></Field>
            <Field label="Homepage title"><Input value={about.homepageTitle || ''} onChange={(e) => setAbout({ ...about, homepageTitle: e.target.value })} /></Field>
            <Field label="Homepage subtitle"><TextArea value={about.homepageSubtitle || ''} onChange={(e) => setAbout({ ...about, homepageSubtitle: e.target.value })} /></Field>
            <Field label="Company introduction"><TextArea value={about.companyIntroduction || ''} onChange={(e) => setAbout({ ...about, companyIntroduction: e.target.value })} rows={4} /></Field>
            <Field label="Founder message"><TextArea value={about.founderMessage || ''} onChange={(e) => setAbout({ ...about, founderMessage: e.target.value })} rows={3} /></Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Mission"><TextArea value={about.mission || ''} onChange={(e) => setAbout({ ...about, mission: e.target.value })} /></Field>
              <Field label="Vision"><TextArea value={about.vision || ''} onChange={(e) => setAbout({ ...about, vision: e.target.value })} /></Field>
            </div>
            <Field label="Experience years"><Input value={about.experienceYears || ''} onChange={(e) => setAbout({ ...about, experienceYears: e.target.value })} /></Field>
            <Field label="Team description"><TextArea value={about.teamDescription || ''} onChange={(e) => setAbout({ ...about, teamDescription: e.target.value })} rows={3} /></Field>
            <Button type="submit" disabled={loading} className="bg-orange-600 font-black text-white hover:bg-orange-700"><Save className="mr-2 h-4 w-4" /> Save About Content</Button>
          </form>
        )}

        {tab === 'services' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-slate-500">{services.length} services</p>
              <Button type="button" onClick={() => setServiceForm({ id: '', slug: '', name: '', shortDescription: '', description: '', heroImage: '', priceLabel: 'Custom quote', features: [], active: true, displayOrder: services.length + 1 })} className="bg-orange-600 font-black text-white hover:bg-orange-700">
                <Plus className="mr-2 h-4 w-4" /> Add Service
              </Button>
            </div>
            {serviceForm && (
              <form onSubmit={(e) => { e.preventDefault(); save('/api/admin/services', { service: serviceForm }, 'Service').then(() => setServiceForm(null)); }} className="space-y-3 rounded-2xl border border-orange-100 bg-orange-50/50 p-4">
                <Field label="Service name"><Input value={serviceForm.name} onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} required /></Field>
                <Field label="Slug"><Input value={serviceForm.slug} onChange={(e) => setServiceForm({ ...serviceForm, slug: e.target.value })} placeholder="auto-generated if empty" /></Field>
                <Field label="Short description"><TextArea value={serviceForm.shortDescription} onChange={(e) => setServiceForm({ ...serviceForm, shortDescription: e.target.value })} /></Field>
                <Field label="Full description"><TextArea value={serviceForm.description} onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })} rows={4} /></Field>
                <Field label="Price label"><Input value={serviceForm.priceLabel} onChange={(e) => setServiceForm({ ...serviceForm, priceLabel: e.target.value })} /></Field>
                <Field label="Hero image URL"><Input value={serviceForm.heroImage} onChange={(e) => setServiceForm({ ...serviceForm, heroImage: e.target.value })} /></Field>
                <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={serviceForm.active !== false} onChange={(e) => setServiceForm({ ...serviceForm, active: e.target.checked })} /> Active</label>
                <div className="flex gap-2">
                  <Button type="submit" disabled={loading} className="bg-orange-600 font-black text-white hover:bg-orange-700">Save Service</Button>
                  <Button type="button" variant="outline" onClick={() => setServiceForm(null)}>Cancel</Button>
                </div>
              </form>
            )}
            {services.map((service, index) => (
              <div key={service.id} className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 lg:grid-cols-[1fr_auto]">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-black">{service.name}</p>
                    <Badge className={service.active !== false ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}>{service.active !== false ? 'Active' : 'Inactive'}</Badge>
                  </div>
                  <p className="text-sm text-slate-500">{service.slug} · {service.priceLabel}</p>
                  <p className="mt-1 text-sm text-slate-600">{service.shortDescription}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => reorderServices(index, -1)}><ArrowUp className="h-4 w-4" /></Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => reorderServices(index, 1)}><ArrowDown className="h-4 w-4" /></Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setServiceForm(service)}>Edit</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => deleteItem(`/api/admin/services/${service.id}`, 'service')}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'rental' && rental && (
          <form onSubmit={(e) => { e.preventDefault(); save('/api/admin/rental-interiors', rental, 'Rental interiors'); }} className="space-y-4">
            <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={rental.active !== false} onChange={(e) => setRental({ ...rental, active: e.target.checked })} /> Enable Rental Interiors</label>
            <Field label="Title"><Input value={rental.name || ''} onChange={(e) => setRental({ ...rental, name: e.target.value })} /></Field>
            <Field label="Short description"><TextArea value={rental.shortDescription || ''} onChange={(e) => setRental({ ...rental, shortDescription: e.target.value })} /></Field>
            <Field label="Full description"><TextArea value={rental.description || ''} onChange={(e) => setRental({ ...rental, description: e.target.value })} rows={4} /></Field>
            <Field label="Hero image"><Input value={rental.heroImage || ''} onChange={(e) => setRental({ ...rental, heroImage: e.target.value })} /></Field>
            <p className="text-sm font-black text-slate-700">Sub-services</p>
            {(rental.subServices || []).map((sub, i) => (
              <div key={sub.id || i} className="grid gap-2 rounded-xl border border-slate-100 p-3 md:grid-cols-2">
                <Input value={sub.name} onChange={(e) => { const subs = [...rental.subServices]; subs[i] = { ...sub, name: e.target.value }; setRental({ ...rental, subServices: subs }); }} placeholder="Sub-service name" />
                <Input value={sub.description} onChange={(e) => { const subs = [...rental.subServices]; subs[i] = { ...sub, description: e.target.value }; setRental({ ...rental, subServices: subs }); }} placeholder="Description" />
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => setRental({ ...rental, subServices: [...(rental.subServices || []), { id: `sub-${Date.now()}`, name: '', description: '', active: true, displayOrder: (rental.subServices?.length || 0) + 1 }] })}>
              <Plus className="mr-2 h-4 w-4" /> Add sub-service
            </Button>
            <Button type="submit" disabled={loading} className="bg-orange-600 font-black text-white hover:bg-orange-700"><Save className="mr-2 h-4 w-4" /> Save Rental Interiors</Button>
          </form>
        )}

        {tab === 'gallery' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <p className="text-sm text-slate-500">{gallery.items.length} gallery items · {gallery.categories.length} categories</p>
              <Button type="button" onClick={() => setGalleryForm({ id: '', title: '', description: '', category: 'Residential', categoryId: 'residential', mediaType: 'image', imageUrl: '', videoUrl: '', thumbnailUrl: '', featured: false, active: true, displayOrder: gallery.items.length + 1 })} className="bg-orange-600 font-black text-white hover:bg-orange-700">
                <Plus className="mr-2 h-4 w-4" /> Add Item
              </Button>
            </div>
            {galleryForm && (
              <form onSubmit={(e) => { e.preventDefault(); save('/api/admin/gallery', { item: galleryForm }, 'Gallery item').then(() => setGalleryForm(null)); }} className="space-y-3 rounded-2xl border border-orange-100 bg-orange-50/50 p-4">
                <Field label="Title"><Input value={galleryForm.title} onChange={(e) => setGalleryForm({ ...galleryForm, title: e.target.value })} required /></Field>
                <Field label="Description"><TextArea value={galleryForm.description} onChange={(e) => setGalleryForm({ ...galleryForm, description: e.target.value })} /></Field>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Category">
                    <select value={galleryForm.categoryId} onChange={(e) => { const cat = gallery.categories.find((c) => c.id === e.target.value); setGalleryForm({ ...galleryForm, categoryId: e.target.value, category: cat?.name || '' }); }} className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm">
                      {gallery.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Media type">
                    <select value={galleryForm.mediaType} onChange={(e) => setGalleryForm({ ...galleryForm, mediaType: e.target.value })} className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm">
                      <option value="image">Image</option>
                      <option value="video">Video</option>
                    </select>
                  </Field>
                </div>
                <Field label="Image URL"><Input value={galleryForm.imageUrl} onChange={(e) => setGalleryForm({ ...galleryForm, imageUrl: e.target.value })} /></Field>
                {galleryForm.mediaType === 'video' && <Field label="Video URL"><Input value={galleryForm.videoUrl} onChange={(e) => setGalleryForm({ ...galleryForm, videoUrl: e.target.value })} /></Field>}
                <Field label="Thumbnail URL"><Input value={galleryForm.thumbnailUrl} onChange={(e) => setGalleryForm({ ...galleryForm, thumbnailUrl: e.target.value })} /></Field>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={galleryForm.featured} onChange={(e) => setGalleryForm({ ...galleryForm, featured: e.target.checked })} /> Featured</label>
                  <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={galleryForm.active !== false} onChange={(e) => setGalleryForm({ ...galleryForm, active: e.target.checked })} /> Active</label>
                </div>
                <Field label="Upload media">
                  <input type="file" accept="image/*,video/*" onChange={(e) => uploadFile(e.target.files?.[0], (url) => setGalleryForm((f) => ({ ...f, [f.mediaType === 'video' ? 'videoUrl' : 'imageUrl']: url, thumbnailUrl: f.thumbnailUrl || url })))} className="text-sm" />
                </Field>
                <div className="flex gap-2">
                  <Button type="submit" disabled={loading} className="bg-orange-600 font-black text-white hover:bg-orange-700">Save Item</Button>
                  <Button type="button" variant="outline" onClick={() => setGalleryForm(null)}>Cancel</Button>
                </div>
              </form>
            )}
            {gallery.items.map((item) => (
              <div key={item.id} className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 lg:grid-cols-[80px_1fr_auto]">
                <div className="h-16 w-16 overflow-hidden rounded-xl bg-slate-200">
                  {item.thumbnailUrl || item.imageUrl ? (
                    <img src={item.thumbnailUrl || item.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">{item.mediaType === 'video' ? <Video className="h-6 w-6 text-slate-400" /> : <Upload className="h-6 w-6 text-slate-400" />}</div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-black">{item.title}</p>
                    {item.featured && <Badge className="bg-orange-100 text-orange-700">Featured</Badge>}
                    <Badge className={item.active !== false ? 'bg-green-100 text-green-700' : 'bg-slate-200'}>{item.active !== false ? 'Active' : 'Inactive'}</Badge>
                    <Badge className="bg-slate-100 text-slate-600">{item.mediaType}</Badge>
                  </div>
                  <p className="text-sm text-slate-500">{item.category}</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setGalleryForm(item)}>Edit</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => deleteItem(`/api/admin/gallery/${item.id}`, 'gallery item')}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'seo' && seo && (
          <form onSubmit={(e) => { e.preventDefault(); save('/api/admin/seo', { seo }, 'SEO settings'); }} className="space-y-6">
            {Object.entries(seo.pages || {}).map(([pageKey, pageSeo]) => (
              <div key={pageKey} className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="font-black capitalize">{pageKey.replace(/([A-Z])/g, ' $1')} Page SEO</p>
                <Field label="Meta title"><Input value={pageSeo.metaTitle || ''} onChange={(e) => setSeo({ ...seo, pages: { ...seo.pages, [pageKey]: { ...pageSeo, metaTitle: e.target.value } } })} /></Field>
                <Field label="Meta description"><TextArea value={pageSeo.metaDescription || ''} onChange={(e) => setSeo({ ...seo, pages: { ...seo.pages, [pageKey]: { ...pageSeo, metaDescription: e.target.value } } })} /></Field>
                <Field label="OG image URL"><Input value={pageSeo.ogImage || ''} onChange={(e) => setSeo({ ...seo, pages: { ...seo.pages, [pageKey]: { ...pageSeo, ogImage: e.target.value } } })} /></Field>
                <Field label="Canonical URL"><Input value={pageSeo.canonicalUrl || ''} onChange={(e) => setSeo({ ...seo, pages: { ...seo.pages, [pageKey]: { ...pageSeo, canonicalUrl: e.target.value } } })} placeholder="https://..." /></Field>
              </div>
            ))}
            <Button type="submit" disabled={loading} className="bg-orange-600 font-black text-white hover:bg-orange-700"><Save className="mr-2 h-4 w-4" /> Save SEO Settings</Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
