'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { OpsRevenueRecord } from '@/lib/ops/revenue/types';
import { REVENUE_STATUSES, REVENUE_STATUS_LABELS, REVENUE_STREAM_LABELS } from '@/lib/ops/revenue/statuses';
import { formatOpsCurrency, formatOpsDate } from '@/components/ops/format';

type RevenueDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordId: string | null;
  onUpdated: () => void;
};

export default function RevenueDrawer({ open, onOpenChange, recordId, onUpdated }: RevenueDrawerProps) {
  const [record, setRecord] = useState<OpsRevenueRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [collectedAmount, setCollectedAmount] = useState('');
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open || !recordId) {
      setRecord(null);
      return;
    }
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/ops/revenue/${recordId}`, { credentials: 'include' });
        const data = await res.json();
        if (res.ok) {
          setRecord(data.record);
          setCollectedAmount(String(data.record.collectedAmount || 0));
          setStatus(data.record.status);
          setNotes(data.record.notes || '');
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [open, recordId]);

  async function save() {
    if (!recordId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ops/revenue/${recordId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectedAmount: Number(collectedAmount) || 0,
          status,
          notes,
        }),
      });
      if (res.ok) {
        onUpdated();
        onOpenChange(false);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{record?.dealNumber || 'Revenue record'}</SheetTitle>
          <SheetDescription>Track brokerage collection without leaving the workspace.</SheetDescription>
        </SheetHeader>
        {loading ? (
          <p className="mt-6 text-sm text-slate-500">Loading…</p>
        ) : record ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p><span className="text-slate-500">Client:</span> {record.clientName || '—'}</p>
              <p><span className="text-slate-500">Project:</span> {record.project || '—'}</p>
              <p><span className="text-slate-500">Stream:</span> {REVENUE_STREAM_LABELS[record.streamType]}</p>
              <p><span className="text-slate-500">Expected:</span> {formatOpsCurrency(record.expectedAmount)}</p>
              <p><span className="text-slate-500">Due:</span> {formatOpsDate(record.dueDate)}</p>
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-slate-500">Collected amount</label>
              <Input type="number" min={0} value={collectedAmount} onChange={(e) => setCollectedAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-slate-500">Status</label>
              <select className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                {REVENUE_STATUSES.map((s) => (
                  <option key={s} value={s}>{REVENUE_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-slate-500">Notes</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
            </div>
            <Button onClick={save} disabled={saving} className="w-full">
              {saving ? 'Saving…' : 'Save revenue record'}
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
