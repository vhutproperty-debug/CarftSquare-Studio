'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Phone, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import CallStatusBadge from '@/components/ops/calls/CallStatusBadge';
import AddProspectDialog from '@/components/ops/calls/AddProspectDialog';
import type { CallQueueItem } from '@/lib/ops/calls/types';
import { formatPhoneDisplay } from '@/lib/ops/phone';

function formatWhen(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return value;
  }
}

const SECTION_TABS = [
  { id: 'all', label: 'All' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'follow_ups_due', label: 'Due Today' },
  { id: 'my_today', label: 'My Today' },
  { id: 'interested', label: 'Interested' },
  { id: 'not_called', label: 'Not Called' },
  { id: 'recently_called', label: 'Recent' },
] as const;

export default function CallsWorkspace() {
  const [section, setSection] = useState<(typeof SECTION_TABS)[number]['id']>('all');
  const [search, setSearch] = useState('');
  const [mineOnly, setMineOnly] = useState(false);
  const [items, setItems] = useState<CallQueueItem[]>([]);
  const [sections, setSections] = useState<Array<{ id: string; label: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ section });
      if (search.trim()) params.set('search', search.trim());
      if (mineOnly) params.set('mineOnly', 'true');
      const response = await fetch(`/api/ops/calls/queue?${params.toString()}`, {
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Unable to load call queue.');
        return;
      }
      setItems(data.items || []);
      setSections(data.sections || []);
    } catch {
      setError('Unable to load call queue.');
    } finally {
      setLoading(false);
    }
  }, [mineOnly, search, section]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {SECTION_TABS.map((tab) => {
            const meta = sections.find((entry) => entry.id === tab.id);
            return (
              <Button
                key={tab.id}
                type="button"
                size="sm"
                variant={section === tab.id ? 'default' : 'outline'}
                onClick={() => setSection(tab.id)}
              >
                {tab.label}
                {meta ? ` (${meta.count})` : ''}
              </Button>
            );
          })}
        </div>
        <Button type="button" onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Add Prospect
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, phone, project…"
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(event) => setMineOnly(event.target.checked)}
          />
          My assigned only
        </label>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
          Loading call queue…
        </div>
      ) : !items.length ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
          No records in this queue section.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <CallQueueCard key={item.id} item={item} />
          ))}
        </div>
      )}

      <AddProspectDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => loadQueue()}
      />
    </div>
  );
}

function CallQueueCard({ item }: { item: CallQueueItem }) {
  const telLink = item.phone && !item.doNotCall && !item.wrongNumber
    ? `tel:+91${item.phone.replace(/\D/g, '').slice(-10)}`
    : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={item.href} className="text-lg font-bold text-slate-900 hover:text-orange-600">
              {item.name || 'Unknown'}
            </Link>
            <CallStatusBadge status={item.callStatus} />
            {item.doNotCall ? (
              <span className="text-xs font-bold uppercase text-red-700">DNC</span>
            ) : null}
          </div>
          <p className="mt-1 text-base font-semibold text-slate-700">{formatPhoneDisplay(item.phone)}</p>
          <p className="mt-1 text-sm text-slate-600">
            {[item.projectName, item.building].filter(Boolean).join(' · ') || '—'}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Last called: {formatWhen(item.lastCalledAt)} · Follow-up: {formatWhen(item.nextFollowUpAt)}
            {item.assignedToName ? ` · ${item.assignedToName}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {telLink ? (
            <Button asChild size="lg" className="h-12 min-w-[120px]">
              <a href={telLink}>
                <Phone className="mr-2 h-4 w-4" aria-hidden="true" />
                Call
              </a>
            </Button>
          ) : (
            <Button size="lg" className="h-12 min-w-[120px]" disabled>
              Call
            </Button>
          )}
          <Button asChild size="lg" variant="secondary" className="h-12">
            <Link href={item.href}>Update</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
