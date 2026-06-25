'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { PaintingTestimonial } from '@/lib/painting/types';

const EMPTY_FORM = {
  id: '',
  name: '',
  location: '',
  rating: '5',
  text: '',
  projectType: '',
  sortOrder: '0',
  active: true,
};

export default function PaintingTestimonialsPanel() {
  const [testimonials, setTestimonials] = useState<PaintingTestimonial[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/painting/testimonials', { credentials: 'include' });
    const data = await res.json();
    if (res.ok) setTestimonials(data.testimonials || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function editItem(item: PaintingTestimonial) {
    setForm({
      id: item.id,
      name: item.name,
      location: item.location || '',
      rating: String(item.rating ?? 5),
      text: item.text,
      projectType: item.projectType || '',
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
      const res = await fetch('/api/admin/painting/testimonials', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(form.id ? { id: form.id } : {}),
          name: form.name.trim(),
          location: form.location.trim(),
          rating: Number(form.rating) || 5,
          text: form.text.trim(),
          projectType: form.projectType.trim(),
          sortOrder: Number(form.sortOrder) || 0,
          active: form.active,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error('Save failed');
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: string) {
    if (!window.confirm('Delete this testimonial?')) return;
    await fetch('/api/admin/painting/testimonials', {
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
        <h3 className="font-bold text-slate-900">{form.id ? 'Edit Testimonial' : 'Add Testimonial'}</h3>
        <Input
          placeholder="Customer name *"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
        />
        <Input
          placeholder="Location (e.g. Andheri West)"
          value={form.location}
          onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
        />
        <Input
          placeholder="Project type (e.g. Interior Painting)"
          value={form.projectType}
          onChange={(e) => setForm((f) => ({ ...f, projectType: e.target.value }))}
        />
        <Input
          type="number"
          min={1}
          max={5}
          placeholder="Rating (1-5)"
          value={form.rating}
          onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))}
        />
        <Textarea
          placeholder="Testimonial text *"
          value={form.text}
          onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
          rows={4}
          required
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
      </form>

      <div className="space-y-3">
        {testimonials.map((item) => (
          <Card key={item.id} className="border-slate-100">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-xs text-slate-500">
                    {[item.location, item.projectType].filter(Boolean).join(' · ')} · {item.rating}★
                  </p>
                  <p className="mt-2 text-sm text-slate-600 line-clamp-3">{item.text}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.active ? 'Active' : 'Hidden'}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => editItem(item)}>Edit</Button>
                  <Button type="button" size="sm" variant="outline" className="text-red-600" onClick={() => deleteItem(item.id)}>Delete</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!testimonials.length && <p className="text-sm text-slate-500">No testimonials yet. Fallback content shows on the live page until you add items.</p>}
      </div>
    </div>
  );
}
