'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { PaintingGalleryItem } from '@/lib/painting/types';

const EMPTY_FORM = {
  id: '',
  title: '',
  imageUrl: '',
  category: '',
  sortOrder: '0',
  active: true,
};

export default function PaintingGalleryPanel() {
  const [items, setItems] = useState<PaintingGalleryItem[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/painting/gallery', { credentials: 'include' });
    const data = await res.json();
    if (res.ok) setItems(data.items || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function editItem(item: PaintingGalleryItem) {
    setForm({
      id: item.id,
      title: item.title,
      imageUrl: item.imageUrl,
      category: item.category || '',
      sortOrder: String(item.sortOrder ?? 0),
      active: item.active,
    });
    setError('');
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/painting/gallery', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(form.id ? { id: form.id } : {}),
          title: form.title.trim(),
          imageUrl: form.imageUrl.trim(),
          category: form.category.trim(),
          sortOrder: Number(form.sortOrder) || 0,
          active: form.active,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.formErrors?.[0] || 'Save failed');
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: string) {
    if (!window.confirm('Delete this gallery item?')) return;
    await fetch('/api/admin/painting/gallery', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    load();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="font-bold text-slate-900">{form.id ? 'Edit Gallery Item' : 'Add Gallery Item'}</h3>
        <Input
          placeholder="Title *"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          required
        />
        <Input
          placeholder="Image URL *"
          value={form.imageUrl}
          onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
          required
        />
        <Input
          placeholder="Category (e.g. Interior, Exterior)"
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
        />
        <Input
          type="number"
          placeholder="Sort order"
          value={form.sortOrder}
          onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
          />
          Active (visible on /painting)
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={saving} className="bg-orange-600 text-white hover:bg-orange-700">
            {saving ? 'Saving…' : 'Save'}
          </Button>
          {form.id && (
            <Button type="button" variant="outline" onClick={() => setForm(EMPTY_FORM)}>Cancel</Button>
          )}
        </div>
        <p className="text-xs text-slate-500">
          Upload images via Admin → CMS → Media, then paste the URL here.
        </p>
      </form>

      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.id} className="border-slate-100">
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-semibold">{item.title}</p>
                <p className="text-xs text-slate-500">{item.category || 'No category'} · Order {item.sortOrder}</p>
                <p className="text-xs text-slate-400">{item.active ? 'Active' : 'Hidden'}</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => editItem(item)}>Edit</Button>
                <Button type="button" size="sm" variant="outline" className="text-red-600" onClick={() => deleteItem(item.id)}>Delete</Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!items.length && <p className="text-sm text-slate-500">No gallery items yet.</p>}
      </div>
    </div>
  );
}
