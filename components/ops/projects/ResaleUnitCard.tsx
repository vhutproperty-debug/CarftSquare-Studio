'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, Pill, selectClass } from '@/components/ops/projects/ui';
import { formatCrore } from '@/lib/ops/projects/format';
import { LISTING_TYPE_LABELS, RESALE_PRIORITIES, RESALE_UNIT_STATUS_LABELS, RESALE_UNIT_STATUSES } from '@/lib/ops/projects/types';
import type { PublicResaleUnit, ResaleUnit, ResaleUnitStatus } from '@/lib/ops/projects/types';

type ListedUnit = PublicResaleUnit | ResaleUnit;

function tone(status: ResaleUnitStatus): 'orange' | 'sky' | 'emerald' | 'slate' {
  if (status === 'for_rent' || status === 'rented') return 'sky';
  if (status === 'for_sale' || status === 'available') return 'emerald';
  if (status === 'follow_up' || status === 'under_offer') return 'orange';
  return 'slate';
}

function isPrivate(unit: ListedUnit): unit is ResaleUnit {
  return 'owner' in unit || 'unitNumber' in unit;
}

export default function ResaleUnitCard({
  unit,
  canManage,
  canSeeSensitive,
  onChanged,
}: {
  unit: ListedUnit;
  canManage: boolean;
  canSeeSensitive: boolean;
  onChanged: () => void;
}) {
  const [status, setStatus] = useState(unit.status);
  const [asking, setAsking] = useState(unit.askingPriceLabel || '');
  const [nextAction, setNextAction] = useState(unit.nextAction || '');
  const [priority, setPriority] = useState(unit.priority || '');
  const [notes, setNotes] = useState(unit.notes || '');
  const [followUp, setFollowUp] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setStatus(unit.status);
    setAsking(unit.askingPriceLabel || '');
    setNextAction(unit.nextAction || '');
    setPriority(unit.priority || '');
    setNotes(unit.notes || '');
  }, [unit]);

  async function send(patch: Record<string, unknown>) {
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/ops/projects/resale', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ recordType: 'unit', slug: unit.slug, projectSlug: unit.projectSlug, ...patch }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error || 'Unable to update the unit.');
        return;
      }
      setFollowUp('');
      onChanged();
    } catch {
      setError('Unable to update the unit.');
    } finally {
      setPending(false);
    }
  }

  const place = [unit.tower ? `Tower ${unit.tower}` : '', unit.floorBand].filter(Boolean).join(' · ');
  const privateUnit = canSeeSensitive && isPrivate(unit) ? unit : null;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link href={`/ops/projects/resale/units/${unit.slug}`} className="font-semibold text-slate-900 hover:text-orange-700">{unit.projectName}</Link>
          <p className="text-sm text-slate-600">{place || 'Tower not recorded'}{unit.bhk ? ` · ${unit.bhk} BHK` : ''}</p>
        </div>
        <Pill tone={tone(unit.status)}>{RESALE_UNIT_STATUS_LABELS[unit.status]}</Pill>
      </div>
      <dl className="mt-3 space-y-1 text-sm text-slate-700">
        <Row label="Config" value={unit.configLabel} />
        <Row label="Carpet" value={unit.carpetSqft ? `${unit.carpetSqft.toLocaleString('en-IN')} sq ft` : ''} />
        <Row label="Floor band" value={unit.floorBand} />
        <Row label="Asking" value={unit.askingPriceLabel || formatCrore(unit.askingPriceCrore)} />
        <Row label="Offer" value={unit.offerTag} />
        <Row label="Intent" value={unit.intent} />
        <Row label="Response" value={unit.response} />
        <Row label="Next" value={unit.nextAction} />
        <Row label="Priority" value={unit.priority} />
        <Row label="Campaign" value={unit.campaign} />
        <Row label="As of" value={unit.asOf} />
        <Row label="Listing" value={LISTING_TYPE_LABELS[unit.listingType]} />
        {privateUnit ? (
          <>
            <Row label="Flat" value={privateUnit.unitNumber} />
            <Row label="Floor" value={privateUnit.floor} />
            <Row label="Owner" value={privateUnit.owner?.name} />
            <Row label="Phone" value={privateUnit.owner?.phone} />
            <Row label="WhatsApp" value={privateUnit.owner?.whatsapp} />
          </>
        ) : null}
      </dl>
      {canManage ? (
        <form
          className="mt-3 space-y-2 border-t border-slate-100 pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            send({ status, askingPriceLabel: asking, nextAction, priority, notes });
          }}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Status">
              <select className={selectClass} value={status} aria-label="Unit status" onChange={(event) => setStatus(event.target.value as ResaleUnitStatus)}>
                {RESALE_UNIT_STATUSES.map((item) => <option key={item} value={item}>{RESALE_UNIT_STATUS_LABELS[item]}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <select className={selectClass} value={priority} aria-label="Priority" onChange={(event) => setPriority(event.target.value as typeof priority)}>
                <option value="">None</option>
                {RESALE_PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Asking price">
            <Input value={asking} aria-label="Asking price" onChange={(event) => setAsking(event.target.value)} placeholder="₹5.50 Cr" />
          </Field>
          <Field label="Next action">
            <Input value={nextAction} aria-label="Next action" onChange={(event) => setNextAction(event.target.value)} />
          </Field>
          <Field label="Notes">
            <Textarea value={notes} aria-label="Unit notes" onChange={(event) => setNotes(event.target.value)} />
          </Field>
          <p className="text-xs text-slate-500">Keep flat numbers and phone numbers out of notes. Those stay in the admin-only fields.</p>
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={pending}>Save</Button>
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => send({ status: 'sold', listingType: 'resale' })}>Mark sold</Button>
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => send({ status: 'rented', listingType: 'rental' })}>Mark rented</Button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[12rem] flex-1">
              <Field label="Follow-up note">
                <Input value={followUp} aria-label="Follow-up note" onChange={(event) => setFollowUp(event.target.value)} placeholder="What happened, and what is next" />
              </Field>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending || !followUp.trim()}
              onClick={() => send({ followUpNote: followUp.trim() })}
            >
              Add follow-up
            </Button>
          </div>
        </form>
      ) : null}
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right">{value || '—'}</dd>
    </div>
  );
}
