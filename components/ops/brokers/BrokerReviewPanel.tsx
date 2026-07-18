'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import ConfidenceBadge from '@/components/ops/brokers/ConfidenceBadge';
import {
  BROKER_REVIEW_REASON_LABELS,
  BROKER_REVIEW_STATUS_LABELS,
} from '@/lib/ops/brokers/statuses';
import type { OpsBrokerReviewItem } from '@/lib/ops/brokers/types';

export default function BrokerReviewPanel() {
  const [items, setItems] = useState<OpsBrokerReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ops/brokers/review?status=PENDING&pageSize=50', {
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Unable to load review queue.');
        return;
      }
      setItems(data.items || []);
    } catch {
      setError('Unable to load review queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, action: 'approve_merge' | 'create_new' | 'ignore') {
    setActingId(id);
    setError('');
    try {
      const res = await fetch(`/api/ops/brokers/review/${id}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Unable to resolve review item.');
        return;
      }
      await load();
    } catch {
      setError('Unable to resolve review item.');
    } finally {
      setActingId(null);
    }
  }

  if (loading) {
    return <div className="rounded-xl border bg-white p-6 text-sm text-slate-500">Loading review queue…</div>;
  }
  if (error) {
    return <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>;
  }
  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-slate-500">
        No pending review items. Listings auto-index into searchable inventory; this queue is only for parser failures and extremely low-confidence records.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900">
                {item.proposed.projectName || 'Unknown project'} · {item.proposed.configuration || '—'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {item.groupName} · {BROKER_REVIEW_STATUS_LABELS[item.status]} · dedupe {item.dedupeConfidence}%
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {item.reasons.map((r) => (
                  <span key={r} className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">
                    {BROKER_REVIEW_REASON_LABELS[r]}
                  </span>
                ))}
              </div>
            </div>
            <ConfidenceBadge value={item.confidence?.overallConfidence} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" disabled={actingId === item.id} onClick={() => act(item.id, 'approve_merge')}>
              Approve merge
            </Button>
            <Button size="sm" variant="outline" disabled={actingId === item.id} onClick={() => act(item.id, 'create_new')}>
              Create new
            </Button>
            <Button size="sm" variant="ghost" disabled={actingId === item.id} onClick={() => act(item.id, 'ignore')}>
              Ignore
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
