'use client';

import { useEffect, useState } from 'react';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import DealDocumentChecklist from '@/components/ops/deals/DealDocumentChecklist';
import DealProbabilityBadge from '@/components/ops/deals/DealProbabilityBadge';
import DealStageBadge from '@/components/ops/deals/DealStageBadge';
import DealTimeline from '@/components/ops/deals/DealTimeline';
import type { DealDocumentsChecklist, OpsDealActivity, OpsDealRecord } from '@/lib/ops/deals/types';
import type { MatchDemandSummary } from '@/lib/ops/matching/types';
import type { OpsSupplyRecord } from '@/lib/ops/supply/types';
import { DEAL_PAYMENT_STATUSES, DEAL_PAYMENT_STATUS_LABELS, DEAL_STAGES, DEAL_STAGE_LABELS } from '@/lib/ops/deals/statuses';
import { formatPhoneDisplay } from '@/lib/ops/phone';
import { supplyDisplayLabel } from '@/lib/ops/supply/types';

type DealDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string | null;
  currentUserId?: string;
  onUpdated: () => void;
};

type DetailState = {
  deal: OpsDealRecord;
  demand: MatchDemandSummary | null;
  supply: OpsSupplyRecord | null;
  activities: OpsDealActivity[];
  team: Array<{ id: string; name: string; email: string }>;
};

export default function DealDrawer({
  open,
  onOpenChange,
  dealId,
  currentUserId,
  onUpdated,
}: DealDrawerProps) {
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [checklist, setChecklist] = useState<DealDocumentsChecklist>({});

  useEffect(() => {
    if (!open || !dealId) {
      setDetail(null);
      return;
    }

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/ops/deals/${dealId}`, { credentials: 'include' });
        const data = await res.json();
        if (res.ok) {
          setDetail({
            deal: data.deal,
            demand: data.demand,
            supply: data.supply,
            activities: data.activities,
            team: data.team,
          });
          setNotes(data.deal.internalNotes || '');
          setChecklist(data.deal.documentsChecklist || {});
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [open, dealId]);

  async function patchDeal(body: Record<string, unknown>) {
    if (!dealId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ops/deals/${dealId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setDetail((current) => current ? {
          ...current,
          deal: data.deal,
          activities: data.activities,
        } : current);
        onUpdated();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        {loading || !detail ? (
          <p className="py-12 text-center text-sm text-slate-500">Loading deal…</p>
        ) : (
          <>
            <SheetHeader className="text-left">
              <div className="flex flex-wrap items-center gap-2 pr-8">
                <DealStageBadge stage={detail.deal.stage} />
                <DealProbabilityBadge probability={detail.deal.probability} />
              </div>
              <SheetTitle className="text-2xl">{detail.deal.dealNumber}</SheetTitle>
              <SheetDescription>
                {detail.deal.clientName || 'Client'} · {detail.deal.project || detail.deal.building || 'Mumbai deal'}
              </SheetDescription>
            </SheetHeader>

            <section className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-700">Client summary</h3>
                <p className="mt-2 font-semibold text-slate-900">{detail.deal.clientName || detail.demand?.name || '—'}</p>
                <p className="text-sm text-slate-600">{formatPhoneDisplay(detail.demand?.phone)}</p>
                <dl className="mt-3 space-y-1 text-xs text-slate-600">
                  <div><dt className="inline font-medium">Requirement: </dt><dd className="inline">{detail.demand?.requirement || '—'}</dd></div>
                  <div><dt className="inline font-medium">Budget: </dt><dd className="inline">{detail.demand?.budget || '—'}</dd></div>
                </dl>
              </div>
              <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-violet-700">Property summary</h3>
                <p className="mt-2 font-semibold text-slate-900">
                  {detail.supply ? supplyDisplayLabel(detail.supply) : detail.deal.building || '—'}
                </p>
                <p className="text-sm text-slate-600">{detail.deal.ownerName || detail.supply?.ownerName || '—'}</p>
                <dl className="mt-3 space-y-1 text-xs text-slate-600">
                  <div><dt className="inline font-medium">Flat: </dt><dd className="inline">{detail.deal.flat || '—'}</dd></div>
                  <div><dt className="inline font-medium">Rent/Price: </dt><dd className="inline">{detail.deal.expectedRent || detail.deal.expectedSaleValue || '—'}</dd></div>
                </dl>
              </div>
            </section>

            <section className="mt-6 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Stage & broker</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  className="h-10 rounded-md border border-slate-200 px-3 text-sm"
                  value={detail.deal.stage}
                  onChange={(e) => patchDeal({ stage: e.target.value })}
                  disabled={saving}
                >
                  {DEAL_STAGES.map((s) => (
                    <option key={s} value={s}>{DEAL_STAGE_LABELS[s]}</option>
                  ))}
                </select>
                <select
                  className="h-10 rounded-md border border-slate-200 px-3 text-sm"
                  value={detail.deal.broker || ''}
                  onChange={(e) => patchDeal({ broker: e.target.value })}
                  disabled={saving}
                >
                  <option value="">Unassigned</option>
                  {currentUserId ? <option value={currentUserId}>Assign to me</option> : null}
                  {detail.team.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </section>

            <section className="mt-6 grid gap-2 sm:grid-cols-2">
              <Field label="Offer amount" value={detail.deal.offerAmount || ''} onSave={(v) => patchDeal({ offerAmount: v })} disabled={saving} />
              <Field label="Expected brokerage" value={detail.deal.expectedBrokerage || ''} onSave={(v) => patchDeal({ expectedBrokerage: v })} disabled={saving} />
              <Field label="Actual brokerage" value={detail.deal.actualBrokerage || ''} onSave={(v) => patchDeal({ actualBrokerage: v })} disabled={saving} />
              <Field label="Commission collected" value={detail.deal.commissionCollected || ''} onSave={(v) => patchDeal({ commissionCollected: v })} disabled={saving} />
              <label className="block text-xs sm:col-span-2">
                <span className="font-medium text-slate-600">Payment status</span>
                <select
                  className="mt-1 h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
                  value={detail.deal.paymentStatus || 'NOT_DUE'}
                  onChange={(e) => patchDeal({ paymentStatus: e.target.value })}
                  disabled={saving}
                >
                  {DEAL_PAYMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>{DEAL_PAYMENT_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </label>
            </section>

            <section className="mt-6 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Negotiation notes</h3>
              <Textarea rows={2} value={detail.deal.negotiationNotes || ''} onChange={(e) => patchDeal({ negotiationNotes: e.target.value })} />
            </section>

            <section className="mt-6 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Documents checklist</h3>
              <DealDocumentChecklist
                checklist={checklist}
                onChange={(next) => {
                  setChecklist(next);
                  patchDeal({ documentsChecklist: next });
                }}
                disabled={saving}
              />
            </section>

            <section className="mt-6 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Internal notes</h3>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              <Button type="button" size="sm" variant="outline" onClick={() => patchDeal({ internalNotes: notes })} disabled={saving}>
                Save notes
              </Button>
            </section>

            <section className="mt-4">
              <Button size="sm" variant="outline" disabled={saving} onClick={() => patchDeal({ stage: 'LOST', lostReason: 'Marked lost by broker' })}>
                <XCircle className="mr-1.5 h-4 w-4" />Mark lost
              </Button>
            </section>

            <section className="mt-6">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Timeline</h3>
              <DealTimeline activities={detail.activities} />
            </section>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  value,
  onSave,
  disabled,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  disabled?: boolean;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <label className="block text-xs">
      <span className="font-medium text-slate-600">{label}</span>
      <Input
        className="mt-1 h-9"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { if (local !== value) onSave(local); }}
        disabled={disabled}
      />
    </label>
  );
}
