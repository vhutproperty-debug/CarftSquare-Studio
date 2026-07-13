'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, MessageCircle, Phone } from 'lucide-react';
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
import AvailabilityCard from '@/components/ops/supply/AvailabilityCard';
import OwnerCard from '@/components/ops/supply/OwnerCard';
import SupplyPriorityBadge from '@/components/ops/supply/SupplyPriorityBadge';
import SupplyStatusBadge from '@/components/ops/supply/SupplyStatusBadge';
import SupplyTimeline from '@/components/ops/supply/SupplyTimeline';
import type { OpsSupplyActivity, OpsSupplyRecord } from '@/lib/ops/supply/types';
import { supplyDisplayLabel } from '@/lib/ops/supply/types';
import {
  SUPPLY_PRIORITIES,
  SUPPLY_SOURCES,
  SUPPLY_STATUSES,
  SUPPLY_PRIORITY_LABELS,
  SUPPLY_SOURCE_LABELS,
  SUPPLY_STATUS_LABELS,
} from '@/lib/ops/supply/statuses';
import { buildTelLink, buildWhatsAppLink } from '@/lib/ops/phone';

type SupplyDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplyId: string | null;
  currentUserId?: string;
  onUpdated: () => void;
};

type DetailState = {
  record: OpsSupplyRecord;
  activities: OpsSupplyActivity[];
  team: Array<{ id: string; name: string; email: string }>;
};

export default function SupplyDrawer({
  open,
  onOpenChange,
  supplyId,
  currentUserId,
  onUpdated,
}: SupplyDrawerProps) {
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpTime, setFollowUpTime] = useState('');
  const [form, setForm] = useState<Partial<OpsSupplyRecord>>({});

  useEffect(() => {
    if (!open || !supplyId) {
      setDetail(null);
      return;
    }

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/ops/supply/${supplyId}`, { credentials: 'include' });
        const data = await res.json();
        if (res.ok) {
          setDetail(data);
          setNotes(data.record.internalNotes || '');
          setForm(data.record);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [open, supplyId]);

  async function patchRecord(body: Record<string, unknown>) {
    if (!supplyId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ops/supply/${supplyId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setDetail((current) => current ? {
          ...current,
          record: data.record,
          activities: data.activities,
        } : current);
        setForm(data.record);
        onUpdated();
      }
    } finally {
      setSaving(false);
    }
  }

  async function postActivity(type: string, message: string, extra?: Record<string, unknown>) {
    if (!supplyId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ops/supply/${supplyId}/activities`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message, ...extra }),
      });
      const data = await res.json();
      if (res.ok) {
        setDetail((current) => current ? {
          ...current,
          record: data.record || current.record,
          activities: data.activities,
        } : current);
        onUpdated();
      }
    } finally {
      setSaving(false);
    }
  }

  async function savePropertyFields() {
    await patchRecord({
      propertyType: form.propertyType,
      listingType: form.listingType,
      project: form.project,
      building: form.building,
      wing: form.wing,
      flatNumber: form.flatNumber,
      configuration: form.configuration,
      carpetArea: form.carpetArea,
      floor: form.floor,
      facing: form.facing,
      parking: form.parking,
      furnishedStatus: form.furnishedStatus,
      ownerName: form.ownerName,
      ownerMobile: form.ownerMobile,
      ownerEmail: form.ownerEmail,
      source: form.source,
      exclusive: form.exclusive,
      expectedRent: form.expectedRent,
      expectedDeposit: form.expectedDeposit,
      expectedSalePrice: form.expectedSalePrice,
      brokeragePercent: form.brokeragePercent,
      keysAvailable: form.keysAvailable,
      tenantOccupied: form.tenantOccupied,
      availableFrom: form.availableFrom || '',
      agreementExpiry: form.agreementExpiry || '',
      possessionStatus: form.possessionStatus,
      availabilityStatus: form.availabilityStatus,
    });
  }

  const telLink = detail?.record.ownerMobile ? buildTelLink(detail.record.ownerMobile) : null;
  const whatsappLink = detail?.record.ownerMobile ? buildWhatsAppLink(
    detail.record.ownerMobile,
    `Hi ${detail.record.ownerName || 'there'}, this is CraftSquare regarding your property listing.`,
  ) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        {loading || !detail ? (
          <p className="py-12 text-center text-sm text-slate-500">Loading listing…</p>
        ) : (
          <>
            <SheetHeader className="text-left">
              <div className="flex flex-wrap items-center gap-2 pr-8">
                <SupplyStatusBadge status={detail.record.status} />
                <SupplyPriorityBadge priority={detail.record.priority} />
                {detail.record.exclusive ? (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-800">Exclusive</span>
                ) : null}
              </div>
              <SheetTitle className="text-2xl">{supplyDisplayLabel(detail.record)}</SheetTitle>
              <SheetDescription>
                {detail.record.project || 'Mumbai listing'} · {detail.record.listingType?.toUpperCase() || '—'}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 flex flex-wrap gap-2">
              {telLink ? (
                <Button
                  size="lg"
                  className="h-11"
                  disabled={saving}
                  onClick={() => postActivity('OWNER_CALLED', 'Owner call logged')}
                  asChild
                >
                  <a href={telLink}><Phone className="mr-2 h-4 w-4" />Call Owner</a>
                </Button>
              ) : null}
              {whatsappLink ? (
                <Button asChild size="lg" variant="outline" className="h-11">
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" />WhatsApp
                  </a>
                </Button>
              ) : null}
              <Button size="lg" variant="outline" className="h-11" disabled={saving} onClick={() => patchRecord({ status: 'VERIFIED' })}>
                <CheckCircle2 className="mr-2 h-4 w-4" />Mark Verified
              </Button>
              <Button size="lg" variant="outline" className="h-11" disabled={saving || detail.record.readyForMatching} onClick={() => patchRecord({ readyForMatching: true, status: 'AVAILABLE' })}>
                Ready for Matching
              </Button>
            </div>

            <section className="mt-6 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Status & assignment</h3>
              <div className="grid gap-2 sm:grid-cols-3">
                <select
                  className="h-10 rounded-md border border-slate-200 px-3 text-sm"
                  value={detail.record.status}
                  onChange={(e) => patchRecord({ status: e.target.value })}
                  disabled={saving}
                >
                  {SUPPLY_STATUSES.map((s) => (
                    <option key={s} value={s}>{SUPPLY_STATUS_LABELS[s]}</option>
                  ))}
                </select>
                <select
                  className="h-10 rounded-md border border-slate-200 px-3 text-sm"
                  value={detail.record.priority}
                  onChange={(e) => patchRecord({ priority: e.target.value })}
                  disabled={saving}
                >
                  {SUPPLY_PRIORITIES.map((p) => (
                    <option key={p} value={p}>{SUPPLY_PRIORITY_LABELS[p]}</option>
                  ))}
                </select>
                <select
                  className="h-10 rounded-md border border-slate-200 px-3 text-sm"
                  value={detail.record.assignedBroker || ''}
                  onChange={(e) => patchRecord({ assignedBroker: e.target.value })}
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

            <div className="mt-6 grid gap-4">
              <OwnerCard record={detail.record} />
              <AvailabilityCard record={detail.record} />
            </div>

            <section className="mt-6 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Property & pricing</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Rent / Sale" value={form.listingType || ''} onChange={(v) => setForm((f) => ({ ...f, listingType: v as OpsSupplyRecord['listingType'] }))} options={['rent', 'sale']} />
                <Field label="Property type" value={form.propertyType || ''} onChange={(v) => setForm((f) => ({ ...f, propertyType: v }))} />
                <Field label="Project" value={form.project || ''} onChange={(v) => setForm((f) => ({ ...f, project: v }))} />
                <Field label="Building" value={form.building || ''} onChange={(v) => setForm((f) => ({ ...f, building: v }))} />
                <Field label="Wing" value={form.wing || ''} onChange={(v) => setForm((f) => ({ ...f, wing: v }))} />
                <Field label="Flat no." value={form.flatNumber || ''} onChange={(v) => setForm((f) => ({ ...f, flatNumber: v }))} />
                <Field label="Configuration" value={form.configuration || ''} onChange={(v) => setForm((f) => ({ ...f, configuration: v }))} />
                <Field label="Carpet area" value={form.carpetArea || ''} onChange={(v) => setForm((f) => ({ ...f, carpetArea: v }))} />
                <Field label="Floor" value={form.floor || ''} onChange={(v) => setForm((f) => ({ ...f, floor: v }))} />
                <Field label="Facing" value={form.facing || ''} onChange={(v) => setForm((f) => ({ ...f, facing: v }))} />
                <Field label="Parking" value={form.parking || ''} onChange={(v) => setForm((f) => ({ ...f, parking: v }))} />
                <Field label="Furnished" value={form.furnishedStatus || ''} onChange={(v) => setForm((f) => ({ ...f, furnishedStatus: v }))} />
                <Field label="Expected rent" value={form.expectedRent || ''} onChange={(v) => setForm((f) => ({ ...f, expectedRent: v }))} />
                <Field label="Expected deposit" value={form.expectedDeposit || ''} onChange={(v) => setForm((f) => ({ ...f, expectedDeposit: v }))} />
                <Field label="Sale price" value={form.expectedSalePrice || ''} onChange={(v) => setForm((f) => ({ ...f, expectedSalePrice: v }))} />
                <Field label="Brokerage %" value={form.brokeragePercent || ''} onChange={(v) => setForm((f) => ({ ...f, brokeragePercent: v }))} />
                <Field label="Owner name" value={form.ownerName || ''} onChange={(v) => setForm((f) => ({ ...f, ownerName: v }))} />
                <Field label="Owner mobile" value={form.ownerMobile || ''} onChange={(v) => setForm((f) => ({ ...f, ownerMobile: v }))} />
                <Field label="Owner email" value={form.ownerEmail || ''} onChange={(v) => setForm((f) => ({ ...f, ownerEmail: v }))} className="sm:col-span-2" />
                <Field label="Source" value={form.source || ''} onChange={(v) => setForm((f) => ({ ...f, source: v as OpsSupplyRecord['source'] }))} options={[...SUPPLY_SOURCES]} optionLabels={SUPPLY_SOURCE_LABELS} />
                <Field label="Availability status" value={form.availabilityStatus || ''} onChange={(v) => setForm((f) => ({ ...f, availabilityStatus: v }))} />
                <Field label="Available from" value={form.availableFrom?.slice(0, 10) || ''} onChange={(v) => setForm((f) => ({ ...f, availableFrom: v ? new Date(v).toISOString() : undefined }))} type="date" />
                <Field label="Agreement expiry" value={form.agreementExpiry?.slice(0, 10) || ''} onChange={(v) => setForm((f) => ({ ...f, agreementExpiry: v ? new Date(v).toISOString() : undefined }))} type="date" />
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!form.exclusive} onChange={(e) => setForm((f) => ({ ...f, exclusive: e.target.checked }))} />
                  Exclusive listing
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!form.keysAvailable} onChange={(e) => setForm((f) => ({ ...f, keysAvailable: e.target.checked }))} />
                  Keys available
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!form.tenantOccupied} onChange={(e) => setForm((f) => ({ ...f, tenantOccupied: e.target.checked }))} />
                  Tenant occupied
                </label>
              </div>
              <Button type="button" size="sm" onClick={savePropertyFields} disabled={saving}>Save listing</Button>
            </section>

            <section className="mt-6 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Internal notes</h3>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              <Button type="button" size="sm" variant="outline" onClick={() => patchRecord({ internalNotes: notes })} disabled={saving}>Add note</Button>
            </section>

            <section className="mt-6 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Follow-up</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
                <Input type="time" value={followUpTime} onChange={(e) => setFollowUpTime(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={saving || !followUpDate || !followUpTime}
                  onClick={() => {
                    const nextFollowUpAt = new Date(`${followUpDate}T${followUpTime}:00`).toISOString();
                    patchRecord({ nextFollowUpAt });
                  }}
                >
                  Schedule
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => patchRecord({ followUpCompleted: true })} disabled={saving}>
                  Mark completed
                </Button>
              </div>
            </section>

            <section className="mt-6">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Activity timeline</h3>
              <SupplyTimeline activities={detail.activities} />
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
  onChange,
  options,
  optionLabels,
  type = 'text',
  className = '',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options?: string[];
  optionLabels?: Record<string, string>;
  type?: string;
  className?: string;
}) {
  if (options) {
    return (
      <label className={`block text-xs ${className}`}>
        <span className="font-medium text-slate-600">{label}</span>
        <select
          className="mt-1 h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">—</option>
          {options.map((o) => (
            <option key={o} value={o}>{optionLabels?.[o] || o}</option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className={`block text-xs ${className}`}>
      <span className="font-medium text-slate-600">{label}</span>
      <Input className="mt-1 h-9" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
