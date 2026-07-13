'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { OpsRenewalRecord } from '@/lib/ops/renewals/types';
import { RENEWAL_STATUSES, RENEWAL_STATUS_LABELS } from '@/lib/ops/renewals/statuses';
import { formatOpsDate } from '@/components/ops/format';

type RenewalDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordId: string | null;
  onUpdated: () => void;
};

export default function RenewalDrawer({ open, onOpenChange, recordId, onUpdated }: RenewalDrawerProps) {
  const [record, setRecord] = useState<OpsRenewalRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open || !recordId) { setRecord(null); return; }
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/ops/renewals/${recordId}`, { credentials: 'include' });
        const data = await res.json();
        if (res.ok) { setRecord(data.record); setStatus(data.record.status); setNotes(data.record.notes || ''); }
      } finally { setLoading(false); }
    }
    load();
  }, [open, recordId]);

  async function save() {
    if (!recordId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ops/renewals/${recordId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes }),
      });
      if (res.ok) { onUpdated(); onOpenChange(false); }
    } finally { setSaving(false); }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{record?.dealNumber || 'Renewal'}</SheetTitle>
          <SheetDescription>Mark renewal outcome and capture follow-up notes.</SheetDescription>
        </SheetHeader>
        {loading ? <p className="mt-6 text-sm text-slate-500">Loading…</p> : record ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p><span className="text-slate-500">Client:</span> {record.clientName || '—'}</p>
              <p><span className="text-slate-500">Due:</span> {formatOpsDate(record.dueDate)}</p>
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-slate-500">Status</label>
              <select className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                {RENEWAL_STATUSES.map((s) => <option key={s} value={s}>{RENEWAL_STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-slate-500">Notes</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
            </div>
            <Button onClick={save} disabled={saving} className="w-full">{saving ? 'Saving…' : 'Save renewal'}</Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
