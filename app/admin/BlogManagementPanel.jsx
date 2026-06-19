'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  ImagePlus,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import RichTextEditor from '@/components/admin/RichTextEditor';
import { slugify } from '@/lib/cms/normalize';
import { adminApiFetch, canAccess, formatDateTime } from '@/lib/auth/rbac/client';

const EMPTY_FORM = {
  id: '',
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  category: 'Interior Design',
  blogType: 'owner',
  tags: '',
  status: 'draft',
  featuredImage: '',
  seo: {
    metaTitle: '',
    metaDescription: '',
    keywords: '',
    ogImage: '',
    canonicalUrl: '',
  },
};

function statusBadgeClass(status) {
  if (status === 'published') return 'bg-emerald-500 text-white hover:bg-emerald-500';
  if (status === 'archived') return 'bg-slate-500 text-white hover:bg-slate-500';
  return 'bg-amber-500 text-white hover:bg-amber-500';
}

export default function BlogManagementPanel({ user, onMessage }) {
  const [view, setView] = useState('list');
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [slugManual, setSlugManual] = useState(false);

  const permissions = useMemo(() => ({
    view: canAccess(user, 'blog', 'view'),
    create: canAccess(user, 'blog', 'create'),
    edit: canAccess(user, 'blog', 'edit'),
    delete: canAccess(user, 'blog', 'delete'),
    publish: canAccess(user, 'blog', 'publish'),
    archive: canAccess(user, 'blog', 'archive'),
  }), [user]);

  const loadPosts = useCallback(async (nextPage = page) => {
    if (!permissions.view) return;
    setLoading(true);
    const params = new URLSearchParams({
      page: String(nextPage),
      limit: '10',
      status: statusFilter,
    });
    if (search.trim()) params.set('q', search.trim());
    if (categoryFilter.trim()) params.set('category', categoryFilter.trim());

    const { response, data, forbidden } = await adminApiFetch(`/api/admin/blog?${params.toString()}`);
    setLoading(false);

    if (forbidden) {
      onMessage?.('Access denied. You do not have permission to view blog posts.');
      return;
    }
    if (!response.ok) {
      onMessage?.(data.error || 'Could not load blog posts.');
      return;
    }

    setPosts(data.posts || []);
    setCategories(data.categories || []);
    setTotalPages(data.totalPages || 1);
    setPage(data.page || nextPage);
  }, [permissions.view, page, search, statusFilter, categoryFilter, onMessage]);

  useEffect(() => {
    loadPosts(1);
  }, [statusFilter, categoryFilter, loadPosts]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setSlugManual(false);
  }

  function openCreate() {
    if (!permissions.create) {
      onMessage?.('You do not have permission to create blog posts.');
      return;
    }
    resetForm();
    setView('editor');
  }

  async function openEdit(post) {
    if (!permissions.edit) {
      onMessage?.('You do not have permission to edit blog posts.');
      return;
    }
    setLoading(true);
    const { response, data } = await adminApiFetch(`/api/admin/blog/${post.id}`);
    setLoading(false);
    if (!response.ok) {
      onMessage?.(data.error || 'Could not load blog post.');
      return;
    }
    const loaded = data.post;
    setForm({
      id: loaded.id,
      title: loaded.title || '',
      slug: loaded.slug || '',
      excerpt: loaded.excerpt || '',
      content: loaded.content || '',
      category: loaded.category || 'Interior Design',
      blogType: loaded.blogType === 'partner' ? 'partner' : 'owner',
      tags: (loaded.tags || []).join(', '),
      status: loaded.status || 'draft',
      featuredImage: loaded.featuredImage || '',
      seo: {
        metaTitle: loaded.seo?.metaTitle || '',
        metaDescription: loaded.seo?.metaDescription || '',
        keywords: (loaded.seo?.keywords || []).join(', '),
        ogImage: loaded.seo?.ogImage || '',
        canonicalUrl: loaded.seo?.canonicalUrl || '',
      },
    });
    setSlugManual(true);
    setView('editor');
  }

  function updateField(key, value) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'title' && !slugManual) {
        next.slug = slugify(value);
        if (!next.seo.metaTitle) next.seo = { ...next.seo, metaTitle: value };
      }
      if (key === 'slug') setSlugManual(true);
      return next;
    });
  }

  function updateSeoField(key, value) {
    setForm((current) => ({
      ...current,
      seo: { ...current.seo, [key]: value },
    }));
  }

  async function uploadFeaturedImage(file) {
    if (!file || !permissions.edit && !permissions.create) return;
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
      setForm((current) => ({
        ...current,
        featuredImage: data.url,
        seo: { ...current.seo, ogImage: current.seo.ogImage || data.url },
      }));
      onMessage?.('Featured image uploaded.');
    } catch (error) {
      onMessage?.(error.message);
    } finally {
      setLoading(false);
    }
  }

  function buildPayload(statusOverride) {
    const status = statusOverride || form.status;
    return {
      title: form.title.trim(),
      slug: form.slug.trim() || slugify(form.title),
      excerpt: form.excerpt.trim(),
      content: form.content,
      contentFormat: 'html',
      category: form.category.trim(),
      blogType: form.blogType === 'partner' ? 'partner' : 'owner',
      tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      status,
      featuredImage: form.featuredImage.trim(),
      seo: {
        metaTitle: form.seo.metaTitle.trim() || form.title.trim(),
        metaDescription: form.seo.metaDescription.trim(),
        keywords: form.seo.keywords.split(',').map((item) => item.trim()).filter(Boolean),
        ogImage: form.seo.ogImage.trim() || form.featuredImage.trim(),
        canonicalUrl: form.seo.canonicalUrl.trim(),
      },
    };
  }

  async function savePost(statusOverride) {
    const status = statusOverride || form.status;
    const isNew = !form.id;

    if (isNew && !permissions.create) {
      onMessage?.('You do not have permission to create blog posts.');
      return;
    }
    if (!isNew && !permissions.edit) {
      onMessage?.('You do not have permission to edit blog posts.');
      return;
    }
    if (status === 'published' && !permissions.publish) {
      onMessage?.('You do not have permission to publish blog posts.');
      return;
    }
    if (status === 'archived' && !permissions.archive) {
      onMessage?.('You do not have permission to archive blog posts.');
      return;
    }

    setLoading(true);
    const payload = buildPayload(status);
    const url = isNew ? '/api/admin/blog' : `/api/admin/blog/${form.id}`;
    const method = isNew ? 'POST' : 'PUT';

    const { response, data } = await adminApiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isNew ? payload : { ...payload, id: form.id }),
    });
    setLoading(false);

    if (!response.ok) {
      onMessage?.(data.error || 'Could not save blog post.');
      return;
    }

    onMessage?.(status === 'published' ? 'Blog post published.' : 'Blog post saved.');
    setForm((current) => ({ ...current, id: data.post.id, status: data.post.status }));
    setSlugManual(true);
    await loadPosts(page);
  }

  async function removePost(post) {
    if (!permissions.delete) {
      onMessage?.('You do not have permission to delete blog posts.');
      return;
    }
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return;

    setLoading(true);
    const { response, data } = await adminApiFetch(`/api/admin/blog/${post.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: post.id }),
    });
    setLoading(false);

    if (!response.ok) {
      onMessage?.(data.error || 'Could not delete blog post.');
      return;
    }

    onMessage?.('Blog post deleted.');
    if (form.id === post.id) {
      resetForm();
      setView('list');
    }
    await loadPosts(page);
  }

  if (!permissions.view) return null;

  return (
    <Card className="border-white/10 bg-white text-slate-950">
      <CardHeader>
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-orange-600" /> Blog Management
            </CardTitle>
            <p className="mt-1 text-sm text-slate-500">Create, edit and publish blog posts. Drafts stay hidden on the public site.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {view === 'editor' && (
              <Button type="button" variant="outline" onClick={() => { setView('list'); resetForm(); }}>
                <ChevronLeft className="mr-2 h-4 w-4" /> Back to list
              </Button>
            )}
            {permissions.create && view === 'list' && (
              <Button type="button" className="bg-orange-600 font-black text-white hover:bg-orange-700" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" /> Add Blog
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => loadPosts(page)} disabled={loading}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {view === 'list' && (
          <>
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && loadPosts(1)}
                  placeholder="Search title, slug, tags…"
                  className="pl-9"
                />
              </div>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-md border border-slate-200 px-3 text-sm font-bold">
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="h-10 rounded-md border border-slate-200 px-3 text-sm font-bold">
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <Button type="button" onClick={() => loadPosts(1)} className="bg-slate-900 text-white hover:bg-slate-800">Search</Button>
            </div>

            <div className="space-y-3">
              {posts.length ? posts.map((post) => (
                <div key={post.id} className="grid gap-3 rounded-2xl border border-slate-100 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-slate-900">{post.title}</p>
                      <Badge className={statusBadgeClass(post.status)}>{post.status}</Badge>
                      {post.blogType === 'partner' ? (
                        <Badge className="bg-violet-600 text-white hover:bg-violet-600">Partner</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">/{post.slug} · {post.category} · {formatDateTime(post.updatedAt || post.publishedAt)}</p>
                    {post.excerpt && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{post.excerpt}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {post.status === 'published' && (
                      <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer">
                        <Button type="button" variant="outline"><Eye className="mr-2 h-4 w-4" /> View</Button>
                      </a>
                    )}
                    {permissions.edit && (
                      <Button type="button" variant="outline" onClick={() => openEdit(post)}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                      </Button>
                    )}
                    {permissions.delete && (
                      <Button type="button" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => removePost(post)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </Button>
                    )}
                  </div>
                </div>
              )) : (
                <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                  No blog posts found. {permissions.create ? 'Click “Add Blog” to create your first post.' : ''}
                </p>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-slate-500">Page {page} of {totalPages}</p>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" disabled={page <= 1 || loading} onClick={() => loadPosts(page - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="outline" disabled={page >= totalPages || loading} onClick={() => loadPosts(page + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {view === 'editor' && (
          <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); savePost(); }}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-bold md:col-span-2">
                Title
                <Input value={form.title} onChange={(event) => updateField('title', event.target.value)} placeholder="Blog post title" required />
              </label>
              <label className="space-y-2 text-sm font-bold">
                Slug
                <Input value={form.slug} onChange={(event) => updateField('slug', event.target.value)} placeholder="url-friendly-slug" required />
              </label>
              <label className="space-y-2 text-sm font-bold">
                Status
                <select value={form.status} onChange={(event) => updateField('status', event.target.value)} className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-bold">
                  <option value="draft">Draft</option>
                  <option value="published" disabled={!permissions.publish}>Published</option>
                  <option value="archived" disabled={!permissions.archive}>Archived</option>
                </select>
              </label>
              <label className="space-y-2 text-sm font-bold">
                Blog type
                <select value={form.blogType} onChange={(event) => updateField('blogType', event.target.value)} className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-bold">
                  <option value="owner">Owner blog (homeowner lead CTAs)</option>
                  <option value="partner">Partner blog (referral program CTA)</option>
                </select>
              </label>
              <label className="space-y-2 text-sm font-bold">
                Category
                <Input value={form.category} onChange={(event) => updateField('category', event.target.value)} list="blog-categories" placeholder="Interior Design" />
                <datalist id="blog-categories">
                  {categories.map((category) => <option key={category} value={category} />)}
                </datalist>
              </label>
              <label className="space-y-2 text-sm font-bold">
                Tags
                <Input value={form.tags} onChange={(event) => updateField('tags', event.target.value)} placeholder="Modular Kitchen, Mumbai" />
              </label>
              <label className="space-y-2 text-sm font-bold md:col-span-2">
                Excerpt
                <textarea value={form.excerpt} onChange={(event) => updateField('excerpt', event.target.value)} className="min-h-[84px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Short summary for cards and SEO" />
              </label>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-100 p-4">
              <p className="text-sm font-black text-slate-800">Featured image</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input value={form.featuredImage} onChange={(event) => updateField('featuredImage', event.target.value)} placeholder="Image URL" className="flex-1" />
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200">
                  <ImagePlus className="h-4 w-4" /> Upload
                  <input type="file" accept="image/*" className="hidden" onChange={(event) => uploadFeaturedImage(event.target.files?.[0])} />
                </label>
              </div>
              {form.featuredImage && (
                <img src={form.featuredImage} alt="Featured preview" className="h-40 w-full max-w-md rounded-xl border border-slate-200 object-cover" />
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-black text-slate-800">Content</p>
              <RichTextEditor value={form.content} onChange={(html) => updateField('content', html)} />
            </div>

            <div className="grid gap-4 rounded-2xl border border-slate-100 p-4 md:grid-cols-2">
              <p className="text-sm font-black text-slate-800 md:col-span-2">SEO</p>
              <label className="space-y-2 text-sm font-bold md:col-span-2">
                SEO title
                <Input value={form.seo.metaTitle} onChange={(event) => updateSeoField('metaTitle', event.target.value)} placeholder="Meta title for search engines" />
              </label>
              <label className="space-y-2 text-sm font-bold md:col-span-2">
                Meta description
                <textarea value={form.seo.metaDescription} onChange={(event) => updateSeoField('metaDescription', event.target.value)} className="min-h-[84px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="155–160 character description" />
              </label>
              <label className="space-y-2 text-sm font-bold md:col-span-2">
                Keywords
                <Input value={form.seo.keywords} onChange={(event) => updateSeoField('keywords', event.target.value)} placeholder="keyword one, keyword two" />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={loading} className="bg-orange-600 font-black text-white hover:bg-orange-700">
                <Save className="mr-2 h-4 w-4" /> Save {form.status === 'draft' ? 'Draft' : 'Post'}
              </Button>
              {permissions.publish && form.status !== 'published' && (
                <Button type="button" disabled={loading} variant="outline" onClick={() => savePost('published')}>
                  Publish
                </Button>
              )}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
