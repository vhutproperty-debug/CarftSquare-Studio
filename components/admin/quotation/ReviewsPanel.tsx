'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { CustomerReview, ReviewStatus } from '@/lib/reviews/types';

const FILTERS: Array<{ id: ReviewStatus | ''; label: string }> = [
  { id: '', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

function statusLabel(status: ReviewStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusBadgeClass(status: ReviewStatus) {
  switch (status) {
    case 'approved':
      return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100';
    case 'rejected':
      return 'bg-red-100 text-red-700 hover:bg-red-100';
    default:
      return 'bg-amber-100 text-amber-800 hover:bg-amber-100';
  }
}

export default function ReviewsPanel() {
  const [reviews, setReviews] = useState<CustomerReview[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | ''>('pending');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    customerName: '',
    projectType: '',
    rating: 5,
    reviewText: '',
    area: '',
    images: '',
  });

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (statusFilter) params.set('status', statusFilter);
    const res = await fetch(`/api/admin/reviews?${params}`, { credentials: 'include' });
    const data = await res.json();
    if (res.ok) setReviews(data.reviews || []);
  }, [search, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function createReview(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    const images = form.images.split(',').map((s) => s.trim()).filter(Boolean);
    const res = await fetch('/api/admin/reviews', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, images, rating: Number(form.rating) }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || 'Failed to create review');
      return;
    }
    setForm({ customerName: '', projectType: '', rating: 5, reviewText: '', area: '', images: '' });
    setMessage('Review saved as Pending Approval.');
    load();
  }

  async function updateStatus(id: string, status: ReviewStatus) {
    const res = await fetch('/api/admin/reviews', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) load();
  }

  async function removeReview(id: string) {
    if (!window.confirm('Delete this review permanently?')) return;
    const res = await fetch('/api/admin/reviews', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) load();
  }

  return (
    <div className="space-y-6">
      <Card className="border-slate-100">
        <CardContent className="space-y-4 p-5">
          <h4 className="font-black text-slate-950">Add Customer Review (Admin)</h4>
          <p className="text-sm text-slate-500">Reviews are saved as Pending Approval and must be approved before appearing on the website.</p>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={createReview}>
            <Input placeholder="Customer name" value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} required />
            <Input placeholder="Project type" value={form.projectType} onChange={(e) => setForm((f) => ({ ...f, projectType: e.target.value }))} required />
            <Input placeholder="Area / Location" value={form.area} onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))} />
            <select value={form.rating} onChange={(e) => setForm((f) => ({ ...f, rating: Number(e.target.value) }))} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
              {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} Stars</option>)}
            </select>
            <Textarea placeholder="Review text" value={form.reviewText} onChange={(e) => setForm((f) => ({ ...f, reviewText: e.target.value }))} className="md:col-span-2 min-h-[96px]" required />
            <Input placeholder="Image URLs (comma-separated, optional)" value={form.images} onChange={(e) => setForm((f) => ({ ...f, images: e.target.value }))} className="md:col-span-2" />
            <Button type="submit" className="bg-orange-600 text-white hover:bg-orange-700 md:col-span-2">Submit for Approval</Button>
          </form>
          {message && <p className="text-sm font-semibold text-emerald-600">{message}</p>}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <Button
              key={filter.id || 'all'}
              size="sm"
              onClick={() => setStatusFilter(filter.id)}
              className={statusFilter === filter.id ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-700'}
            >
              {filter.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search reviews..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
          <Button variant="outline" onClick={load}>Refresh</Button>
        </div>
      </div>

      <div className="space-y-4">
        {reviews.map((review) => (
          <Card key={review.id} className="border-slate-100">
            <CardContent className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-black">{review.customerName}</p>
                <Badge variant="outline">{review.projectType}</Badge>
                <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">{review.rating} ★</Badge>
                <Badge className={statusBadgeClass(review.status)}>{statusLabel(review.status)}</Badge>
              </div>
              <p className="mt-2 text-sm text-slate-600">&quot;{review.reviewText}&quot;</p>
              {review.area ? <p className="mt-1 text-sm text-slate-500">{review.area}</p> : null}
              <p className="mt-2 text-xs text-slate-500">
                Submitted: {new Date(review.createdAt).toLocaleString('en-IN')}
                {review.approvedAt && review.status === 'approved'
                  ? ` · Approved: ${new Date(review.approvedAt).toLocaleString('en-IN')}`
                  : ''}
              </p>
              {review.images?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {review.images.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" className="text-xs text-orange-600 underline">Image</a>
                  ))}
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  disabled={review.status === 'approved'}
                  onClick={() => updateStatus(review.id, 'approved')}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-200 text-red-700 hover:bg-red-50"
                  disabled={review.status === 'rejected'}
                  onClick={() => updateStatus(review.id, 'rejected')}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-slate-300 text-slate-700 hover:bg-slate-50"
                  onClick={() => removeReview(review.id)}
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!reviews.length && (
          <p className="text-slate-500">
            {statusFilter ? `No ${statusFilter} reviews found.` : 'No reviews yet.'}
          </p>
        )}
      </div>
    </div>
  );
}
