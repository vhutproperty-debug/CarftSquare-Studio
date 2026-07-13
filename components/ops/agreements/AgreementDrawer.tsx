'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { OpsAgreementRecord } from '@/lib/ops/agreements/types';
import { AGREEMENT_STATUSES, AGREEMENT_STATUS_LABELS, AGREEMENT_TYPES, AGREEMENT_TYPE_LABELS } from '@/lib/ops/agreements/statuses';

type AgreementDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordId: string | null;
  onUpdated: () => void;
};

export default function AgreementDrawer({ open, onOpenChange, recordId, onUpdated }: AgreementDrawerProps) {
  const [record, setRecord] = useState<OpsAgreementRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [agreementType, setAgreementType] = useState('');
  const [documentsComplete, setDocumentsComplete] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open || !recordId) { setRecord(null); return; }
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/ops/agreements/${recordId}`, { credentials: 'include' });
        const data = await res.json();
        if (res.ok) {
          setRecord(data.record);
          setStatus(data.record.status);
          setAgreementType(data.record.agreementType);
          setDocumentsComplete(data.record.documentsComplete);
          setExpiryDate(data.record.expiryDate ? data.record.expiryDate.slice(0, 10) : '');
          setNotes(data.record.notes || '');
        }
      } finally { setLoading(false); }
    }
    load();
  }, [open, recordId]);

  async function save() {
    if (!recordId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ops/agreements/${recordId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, agreementType, documentsComplete, expiryDate, notes }),
      });
      if (res.ok) { onUpdated(); onOpenChange(false); }
    } finally { setSaving(false); }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{record?.dealNumber || 'Agreement'}</SheetTitle>
          <SheetDescription>Track agreement status, documents, and renewal dates.</SheetDescription>
        </SheetHeader>
        {loading ? <p className="mt-6 text-sm text-slate-500">Loading…</p> : record ? (
          <div className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-bold uppercase text-slate-500">Status</label>
              <select className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                {AGREEMENT_STATUSES.map((s) => <option key={s} value={s}>{AGREEMENT_STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-slate-500">Type</label>
              <select className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm" value={agreementType} onChange={(e) => setAgreementType(e.target.value)}>
                {AGREEMENT_TYPES.map((t) => <option key={t} value={t}>{AGREEMENT_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-slate-500">Expiry date</label>
              <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={documentsComplete} onChange={(e) => setDocumentsComplete(e.target.checked)} />
              Documents complete
            </label>
            <div>
              <label className="text-xs font-bold uppercase text-slate-500">Notes</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
            </div>
            <Button onClick={save} disabled={saving} className="w-full">{saving ? 'Saving…' : 'Save agreement'}</Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
