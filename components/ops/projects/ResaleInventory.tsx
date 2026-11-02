'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState, Field, Notice, Pill, ProjectsTabs, selectClass } from '@/components/ops/projects/ui';
import { formatCrore } from '@/lib/ops/projects/format';
import {
  LISTING_TYPE_LABELS,
  LISTING_TYPES,
  PRICE_BANDS,
  RESALE_UNIT_STATUS_LABELS,
  RESALE_UNIT_STATUSES,
} from '@/lib/ops/projects/types';
import type { PublicResaleUnit, ResaleProject, ResaleUnit } from '@/lib/ops/projects/types';

type ListedProject = ResaleProject & { unitCount: number };
type ListedUnit = PublicResaleUnit | ResaleUnit;

type ListResponse = {
  projects: ListedProject[];
  units: ListedUnit[];
  filterOptions: {
    localities: string[];
    projects: { slug: string; name: string }[];
    towers: string[];
    floorBands: string[];
    bhks: number[];
  };
  canManage: boolean;
  canSeeSensitive: boolean;
};

function hasOwner(unit: ListedUnit): unit is ResaleUnit {
  return 'owner' in unit || 'unitNumber' in unit;
}

export default function ResaleInventory() {
  const router = useRouter();
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [locality, setLocality] = useState('');
  const [project, setProject] = useState('');
  const [tower, setTower] = useState('');
  const [bhk, setBhk] = useState('');
  const [status, setStatus] = useState('');
  const [priceBand, setPriceBand] = useState('');
  const [floorBand, setFloorBand] = useState('');
  const [listingType, setListingType] = useState('');
  const [addingProject, setAddingProject] = useState(false);
  const [addingUnit, setAddingUnit] = useState(false);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (locality) params.set('locality', locality);
    if (project) params.set('project', project);
    if (tower) params.set('tower', tower);
    if (bhk) params.set('bhk', bhk);
    if (status) params.set('status', status);
    if (priceBand) params.set('priceBand', priceBand);
    if (floorBand) params.set('floorBand', floorBand);
    if (listingType) params.set('listingType', listingType);
    try {
      const response = await fetch(`/api/ops/projects/resale?${params}`, { credentials: 'include' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error || 'Unable to load resale inventory.');
        return;
      }
      setData(body);
    } catch {
      setError('Unable to load resale inventory.');
    } finally {
      setLoading(false);
    }
  }, [bhk, floorBand, listingType, locality, priceBand, project, q, status, tower]);

  useEffect(() => {
    const timer = setTimeout(() => { load(); }, q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, q]);

  async function submit(payload: Record<string, unknown>, nextPath: (body: { project?: { slug: string }; unit?: { slug: string } }) => string) {
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/ops/projects/resale', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error || 'Unable to save.');
        return;
      }
      router.push(nextPath(body));
    } catch {
      setError('Unable to save.');
    } finally {
      setPending(false);
    }
  }

  const options = data?.filterOptions;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ProjectsTabs />
        {data?.canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setAddingProject((open) => !open)}>Add project</Button>
            <Button type="button" size="sm" onClick={() => setAddingUnit((open) => !open)}>Add unit</Button>
          </div>
        ) : null}
      </div>
      <p className="text-sm text-slate-600">
        Individual resale and rental flats. Flat numbers and owner contacts are visible to admins only.
      </p>
      {addingProject && data?.canManage ? (
        <ProjectCreate pending={pending} onCancel={() => setAddingProject(false)} onSubmit={(payload) => submit(payload, (body) => `/ops/projects/resale/${body.project?.slug}`)} />
      ) : null}
      {addingUnit && data?.canManage ? (
        <UnitCreate
          projects={options?.projects || []}
          canSeeSensitive={Boolean(data.canSeeSensitive)}
          pending={pending}
          onCancel={() => setAddingUnit(false)}
          onSubmit={(payload) => submit(payload, (body) => `/ops/projects/resale/units/${body.unit?.slug}`)}
        />
      ) : null}
      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
        <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search project or tower" aria-label="Search resale inventory" />
        <select className={selectClass} aria-label="Filter by locality" value={locality} onChange={(event) => setLocality(event.target.value)}>
          <option value="">All localities</option>
          {(options?.localities || []).map((item) => <option key={item}>{item}</option>)}
        </select>
        <select className={selectClass} aria-label="Filter by project" value={project} onChange={(event) => setProject(event.target.value)}>
          <option value="">All projects</option>
          {(options?.projects || []).map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
        </select>
        <select className={selectClass} aria-label="Filter by tower" value={tower} onChange={(event) => setTower(event.target.value)}>
          <option value="">All towers</option>
          {(options?.towers || []).map((item) => <option key={item}>{item}</option>)}
        </select>
        <select className={selectClass} aria-label="Filter by BHK" value={bhk} onChange={(event) => setBhk(event.target.value)}>
          <option value="">All BHK</option>
          {(options?.bhks || []).map((item) => <option key={item} value={String(item)}>{item} BHK</option>)}
        </select>
        <select className={selectClass} aria-label="Filter by floor band" value={floorBand} onChange={(event) => setFloorBand(event.target.value)}>
          <option value="">All floors</option>
          {(options?.floorBands || []).map((item) => <option key={item}>{item}</option>)}
        </select>
        <select className={selectClass} aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          {RESALE_UNIT_STATUSES.map((item) => <option key={item} value={item}>{RESALE_UNIT_STATUS_LABELS[item]}</option>)}
        </select>
        <select className={selectClass} aria-label="Filter by price band" value={priceBand} onChange={(event) => setPriceBand(event.target.value)}>
          <option value="">All prices</option>
          {PRICE_BANDS.map((band) => <option key={band.id} value={band.id}>{band.label}</option>)}
        </select>
        <select className={selectClass} aria-label="Filter by listing type" value={listingType} onChange={(event) => setListingType(event.target.value)}>
          <option value="">Resale and rental</option>
          {LISTING_TYPES.map((item) => <option key={item} value={item}>{LISTING_TYPE_LABELS[item]}</option>)}
        </select>
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {loading && !data ? <Notice tone="info">Loading resale inventory…</Notice> : null}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Project groupings</h2>
        {data && data.projects.length === 0 ? <EmptyState>No resale projects match these filters.</EmptyState> : null}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {(data?.projects || []).map((item) => (
            <Link key={item.id} href={`/ops/projects/resale/${item.slug}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-orange-200">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{item.name}</h3>
                <Pill tone="slate">Resale</Pill>
              </div>
              <p className="mt-1 text-sm text-slate-600">{item.developer || 'Developer not recorded'}</p>
              <p className="mt-3 text-sm text-slate-700">{item.locality || 'Locality not recorded'}</p>
              <p className="mt-1 text-sm text-slate-500">{item.unitCount} unit{item.unitCount === 1 ? '' : 's'}</p>
            </Link>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Units</h2>
        {data && data.units.length === 0 ? <EmptyState>No units yet. Oberoi groupings are ready for flats to be added.</EmptyState> : null}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(data?.units || []).map((unit) => (
            <Link key={unit.id} href={`/ops/projects/resale/units/${unit.slug}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-orange-200">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-slate-900">{unit.projectName}</h3>
                  <p className="text-sm text-slate-600">{[unit.tower && `Tower ${unit.tower}`, unit.bhk ? `${unit.bhk} BHK` : ''].filter(Boolean).join(' · ') || 'Configuration not recorded'}</p>
                </div>
                <Pill tone={unit.status === 'available' ? 'emerald' : unit.status === 'under_offer' ? 'orange' : 'slate'}>{RESALE_UNIT_STATUS_LABELS[unit.status]}</Pill>
              </div>
              <dl className="mt-3 space-y-1 text-sm text-slate-700">
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Carpet</dt><dd>{unit.carpetSqft ? `${unit.carpetSqft.toLocaleString('en-IN')} sq ft` : '—'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Floor</dt><dd>{unit.floorBand || '—'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Asking</dt><dd>{unit.askingPriceLabel || formatCrore(unit.askingPriceCrore)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Type</dt><dd>{LISTING_TYPE_LABELS[unit.listingType]}</dd></div>
                {data?.canSeeSensitive && hasOwner(unit) ? (
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Flat</dt><dd>{unit.unitNumber || '—'}</dd></div>
                ) : null}
              </dl>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProjectCreate({
  pending,
  onSubmit,
  onCancel,
}: {
  pending: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [developer, setDeveloper] = useState('');
  const [locality, setLocality] = useState('');
  const [notes, setNotes] = useState('');
  return (
    <form
      className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ recordType: 'project', name, developer, locality, notes, towers: [], usps: [], amenities: [], sourceLinks: [] });
      }}
    >
      <Field label="Project"><Input value={name} onChange={(event) => setName(event.target.value)} required aria-label="Resale project name" /></Field>
      <Field label="Developer"><Input value={developer} onChange={(event) => setDeveloper(event.target.value)} aria-label="Resale developer" /></Field>
      <Field label="Locality"><Input value={locality} onChange={(event) => setLocality(event.target.value)} aria-label="Resale locality" /></Field>
      <Field label="Notes"><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} aria-label="Resale project notes" /></Field>
      <div className="flex gap-2 md:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Add project grouping'}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function UnitCreate({
  projects,
  canSeeSensitive,
  pending,
  onSubmit,
  onCancel,
}: {
  projects: { slug: string; name: string }[];
  canSeeSensitive: boolean;
  pending: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [projectSlug, setProjectSlug] = useState(projects[0]?.slug || '');
  const [tower, setTower] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [bhk, setBhk] = useState('');
  const [carpetSqft, setCarpetSqft] = useState('');
  const [floorBand, setFloorBand] = useState('');
  const [askingPriceLabel, setAskingPriceLabel] = useState('');
  const [status, setStatus] = useState('available');
  const [listingType, setListingType] = useState('resale');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [notes, setNotes] = useState('');
  return (
    <form
      className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          recordType: 'unit',
          projectSlug,
          tower,
          unitNumber: canSeeSensitive ? unitNumber : undefined,
          bhk: bhk ? Number(bhk) : null,
          carpetSqft: carpetSqft ? Number(carpetSqft) : null,
          floorBand,
          askingPriceLabel,
          status,
          listingType,
          notes,
          owner: canSeeSensitive ? { name: ownerName, phone: ownerPhone, email: ownerEmail } : undefined,
        });
      }}
    >
      <Field label="Project">
        <select className={selectClass} value={projectSlug} onChange={(event) => setProjectSlug(event.target.value)} aria-label="Unit project" required>
          <option value="">Choose a project</option>
          {projects.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
        </select>
      </Field>
      <Field label="Tower"><Input value={tower} onChange={(event) => setTower(event.target.value)} aria-label="Tower" /></Field>
      <Field label="BHK"><Input value={bhk} onChange={(event) => setBhk(event.target.value)} inputMode="decimal" aria-label="BHK" /></Field>
      <Field label="Carpet sq ft"><Input value={carpetSqft} onChange={(event) => setCarpetSqft(event.target.value)} inputMode="decimal" aria-label="Carpet" /></Field>
      <Field label="Floor band"><Input value={floorBand} onChange={(event) => setFloorBand(event.target.value)} placeholder="low, mid, high, or 10–15" aria-label="Floor band" /></Field>
      <Field label="Asking price"><Input value={askingPriceLabel} onChange={(event) => setAskingPriceLabel(event.target.value)} placeholder="₹6.5 Cr" aria-label="Asking price" /></Field>
      <Field label="Status">
        <select className={selectClass} value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Unit status">
          {RESALE_UNIT_STATUSES.map((item) => <option key={item} value={item}>{RESALE_UNIT_STATUS_LABELS[item]}</option>)}
        </select>
      </Field>
      <Field label="Listing">
        <select className={selectClass} value={listingType} onChange={(event) => setListingType(event.target.value)} aria-label="Listing type">
          {LISTING_TYPES.map((item) => <option key={item} value={item}>{LISTING_TYPE_LABELS[item]}</option>)}
        </select>
      </Field>
      {canSeeSensitive ? (
        <>
          <Field label="Flat number"><Input value={unitNumber} onChange={(event) => setUnitNumber(event.target.value)} aria-label="Flat number" /></Field>
          <Field label="Owner name"><Input value={ownerName} onChange={(event) => setOwnerName(event.target.value)} aria-label="Owner name" /></Field>
          <Field label="Owner phone"><Input value={ownerPhone} onChange={(event) => setOwnerPhone(event.target.value)} aria-label="Owner phone" /></Field>
          <Field label="Owner email"><Input value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} aria-label="Owner email" /></Field>
        </>
      ) : null}
      <div className="md:col-span-3">
        <Field label="Notes">
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} aria-label="Unit notes" />
        </Field>
        <p className="mt-1 text-xs text-slate-500">Do not put the flat number or owner details in notes or the tower. Those stay in the admin-only fields.</p>
      </div>
      <div className="flex gap-2 md:col-span-3">
        <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Add unit'}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
