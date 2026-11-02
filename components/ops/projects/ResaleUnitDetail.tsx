'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Fact, Field, Notice, Pill, ProjectsTabs, selectClass } from '@/components/ops/projects/ui';
import { formatCrore, formatWhen } from '@/lib/ops/projects/format';
import { LISTING_TYPE_LABELS, LISTING_TYPES, RESALE_UNIT_STATUS_LABELS, RESALE_UNIT_STATUSES } from '@/lib/ops/projects/types';
import type { ResaleUnit } from '@/lib/ops/projects/types';

type UnitView = Partial<ResaleUnit> & Pick<ResaleUnit, 'id' | 'slug' | 'projectSlug' | 'projectName' | 'tower' | 'bhk' | 'carpetSqft' | 'floorBand' | 'askingPriceCrore' | 'askingPriceLabel' | 'status' | 'listingType' | 'notes' | 'sourceLinks' | 'lastUpdatedBy' | 'lastUpdatedAt'>;

export default function ResaleUnitDetail({ unitId }: { unitId: string }) {
  const router = useRouter();
  const [unit, setUnit] = useState<UnitView | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [canSeeSensitive, setCanSeeSensitive] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const response = await fetch(`/api/ops/projects/resale/${unitId}?recordType=unit`, { credentials: 'include' });
        const body = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (response.status === 404) {
          setMissing(true);
          return;
        }
        if (!response.ok) {
          setError(body.error || 'Unable to load the unit.');
          return;
        }
        setUnit(body.unit);
        setCanManage(Boolean(body.canManage));
        setCanSeeSensitive(Boolean(body.canSeeSensitive));
      } catch {
        if (!cancelled) setError('Unable to load the unit.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [unitId]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!unit) return;
    setPending(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = {
      recordType: 'unit',
      projectSlug: unit.projectSlug,
      tower: String(form.get('tower') || ''),
      bhk: form.get('bhk') ? Number(form.get('bhk')) : null,
      carpetSqft: form.get('carpetSqft') ? Number(form.get('carpetSqft')) : null,
      floorBand: String(form.get('floorBand') || ''),
      askingPriceLabel: String(form.get('askingPriceLabel') || ''),
      status: String(form.get('status') || 'available'),
      listingType: String(form.get('listingType') || 'resale'),
      notes: String(form.get('notes') || ''),
      sourceLinks: String(form.get('sourceLinks') || '').split('\n').map((line) => line.trim()).filter(Boolean),
    };
    if (canSeeSensitive) {
      payload.unitNumber = String(form.get('unitNumber') || '');
      payload.owner = {
        name: String(form.get('ownerName') || ''),
        phone: String(form.get('ownerPhone') || ''),
        email: String(form.get('ownerEmail') || ''),
      };
    }
    try {
      const response = await fetch(`/api/ops/projects/resale/${unit.slug}?recordType=unit`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error || 'Unable to save the unit.');
        return;
      }
      setUnit(body.unit);
      setEditing(false);
    } catch {
      setError('Unable to save the unit.');
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!unit || !window.confirm('Delete this unit?')) return;
    setPending(true);
    const response = await fetch(`/api/ops/projects/resale/${unit.slug}?recordType=unit`, { method: 'DELETE', credentials: 'include' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || 'Unable to delete the unit.');
      setPending(false);
      return;
    }
    router.push(`/ops/projects/resale/${unit.projectSlug}`);
  }

  const owner = unit && 'owner' in unit ? unit.owner : undefined;
  const unitNumber = unit && 'unitNumber' in unit ? unit.unitNumber : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ProjectsTabs />
        {unit ? <Link href={`/ops/projects/resale/${unit.projectSlug}`} className="text-sm font-medium text-slate-500 hover:text-orange-700">Back to {unit.projectName}</Link> : null}
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {loading ? <Notice tone="info">Loading unit…</Notice> : null}
      {missing ? <Notice tone="info">This unit is not in the inventory.</Notice> : null}
      {unit && editing ? (
        <form onSubmit={save} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
          <Field label="Tower"><Input name="tower" defaultValue={unit.tower} aria-label="Tower" /></Field>
          <Field label="BHK"><Input name="bhk" defaultValue={unit.bhk ?? ''} aria-label="BHK" /></Field>
          <Field label="Carpet sq ft"><Input name="carpetSqft" defaultValue={unit.carpetSqft ?? ''} aria-label="Carpet" /></Field>
          <Field label="Floor band"><Input name="floorBand" defaultValue={unit.floorBand} aria-label="Floor band" /></Field>
          <Field label="Asking price"><Input name="askingPriceLabel" defaultValue={unit.askingPriceLabel} aria-label="Asking price" /></Field>
          <Field label="Status">
            <select name="status" className={selectClass} defaultValue={unit.status} aria-label="Status">
              {RESALE_UNIT_STATUSES.map((item) => <option key={item} value={item}>{RESALE_UNIT_STATUS_LABELS[item]}</option>)}
            </select>
          </Field>
          <Field label="Listing">
            <select name="listingType" className={selectClass} defaultValue={unit.listingType} aria-label="Listing type">
              {LISTING_TYPES.map((item) => <option key={item} value={item}>{LISTING_TYPE_LABELS[item]}</option>)}
            </select>
          </Field>
          {canSeeSensitive ? (
            <>
              <Field label="Flat number"><Input name="unitNumber" defaultValue={unitNumber || ''} aria-label="Flat number" /></Field>
              <Field label="Owner name"><Input name="ownerName" defaultValue={owner?.name || ''} aria-label="Owner name" /></Field>
              <Field label="Owner phone"><Input name="ownerPhone" defaultValue={owner?.phone || ''} aria-label="Owner phone" /></Field>
              <Field label="Owner email"><Input name="ownerEmail" defaultValue={owner?.email || ''} aria-label="Owner email" /></Field>
            </>
          ) : null}
          <div className="md:col-span-2">
            <Field label="Notes"><Textarea name="notes" defaultValue={unit.notes} aria-label="Notes" /></Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Source links"><Textarea name="sourceLinks" defaultValue={unit.sourceLinks.join('\n')} aria-label="Source links" /></Field>
          </div>
          <div className="flex gap-2 md:col-span-2">
            <Button type="submit" disabled={pending}>Save unit</Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </form>
      ) : null}
      {unit && !editing ? (
        <article className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{unit.projectName}</h2>
              <p className="mt-1 text-sm text-slate-600">{[unit.tower && `Tower ${unit.tower}`, unit.bhk ? `${unit.bhk} BHK` : ''].filter(Boolean).join(' · ') || 'Unit'}</p>
            </div>
            <Pill tone={unit.status === 'available' ? 'emerald' : unit.status === 'under_offer' ? 'orange' : 'slate'}>
              {RESALE_UNIT_STATUS_LABELS[unit.status]} · {LISTING_TYPE_LABELS[unit.listingType]}
            </Pill>
          </div>
          {canManage ? (
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={() => setEditing(true)}>Edit</Button>
              <Button type="button" size="sm" variant="destructive" disabled={pending} onClick={remove}>Delete</Button>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Fact label="Carpet" value={unit.carpetSqft ? `${unit.carpetSqft.toLocaleString('en-IN')} sq ft` : ''} />
            <Fact label="Floor band" value={unit.floorBand} />
            <Fact label="Asking price" value={unit.askingPriceLabel || formatCrore(unit.askingPriceCrore)} />
            {canSeeSensitive ? <Fact label="Flat number" value={unitNumber || ''} /> : null}
          </div>
          {canSeeSensitive ? (
            <section>
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Owner</h3>
              <p className="mt-1 text-sm text-slate-500">Visible to admin roles only.</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <Fact label="Name" value={owner?.name} />
                <Fact label="Phone" value={owner?.phone} />
                <Fact label="Email" value={owner?.email} />
              </div>
            </section>
          ) : (
            <Notice tone="info">Flat number and owner contact are hidden for non-admin roles.</Notice>
          )}
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Notes</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{unit.notes || '—'}</p>
          </section>
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Sources</h3>
            {unit.sourceLinks.length === 0 ? <p className="mt-2 text-sm text-slate-500">No source links.</p> : (
              <ul className="mt-2 space-y-1 text-sm">
                {unit.sourceLinks.map((link) => <li key={link}><a className="break-all text-orange-700 hover:underline" href={link} target="_blank" rel="noreferrer">{link}</a></li>)}
              </ul>
            )}
          </section>
          <p className="text-xs text-slate-500">Last updated by {unit.lastUpdatedBy || '—'} at {formatWhen(unit.lastUpdatedAt)}</p>
        </article>
      ) : null}
    </div>
  );
}
