'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Fact, Field, Notice, Pill, ProjectsTabs } from '@/components/ops/projects/ui';
import { formatCrore, formatWhen } from '@/lib/ops/projects/format';
import { LISTING_TYPE_LABELS, RESALE_UNIT_STATUS_LABELS } from '@/lib/ops/projects/types';
import type { PublicResaleUnit, ResaleProject, ResaleUnit } from '@/lib/ops/projects/types';

type Unit = PublicResaleUnit | ResaleUnit;

export default function ResaleProjectDetail({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<ResaleProject | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [canSeeSensitive, setCanSeeSensitive] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({ name: '', developer: '', locality: '', towers: '', maharera: '', notes: '', usps: '', amenities: '', sourceLinks: '' });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const response = await fetch(`/api/ops/projects/resale/${projectId}?recordType=project`, { credentials: 'include' });
        const body = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (response.status === 404) {
          setMissing(true);
          return;
        }
        if (!response.ok) {
          setError(body.error || 'Unable to load the project.');
          return;
        }
        setProject(body.project);
        setUnits(body.units || []);
        setCanManage(Boolean(body.canManage));
        setCanSeeSensitive(Boolean(body.canSeeSensitive));
        setDraft({
          name: body.project.name || '',
          developer: body.project.developer || '',
          locality: body.project.locality || '',
          towers: (body.project.towers || []).join('\n'),
          maharera: body.project.maharera || '',
          notes: body.project.notes || '',
          usps: (body.project.usps || []).join('\n'),
          amenities: (body.project.amenities || []).join('\n'),
          sourceLinks: (body.project.sourceLinks || []).join('\n'),
        });
      } catch {
        if (!cancelled) setError('Unable to load the project.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [projectId]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!project) return;
    setPending(true);
    setError('');
    const lines = (value: string) => value.split('\n').map((line) => line.trim()).filter(Boolean);
    try {
      const response = await fetch(`/api/ops/projects/resale/${project.slug}?recordType=project`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          recordType: 'project',
          name: draft.name,
          developer: draft.developer,
          locality: draft.locality,
          towers: lines(draft.towers),
          maharera: draft.maharera,
          notes: draft.notes,
          usps: lines(draft.usps),
          amenities: lines(draft.amenities),
          sourceLinks: lines(draft.sourceLinks),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error || 'Unable to save the project.');
        return;
      }
      setProject(body.project);
      setEditing(false);
    } catch {
      setError('Unable to save the project.');
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!project || !window.confirm(`Delete ${project.name}? Units must be removed first.`)) return;
    setPending(true);
    const response = await fetch(`/api/ops/projects/resale/${project.slug}?recordType=project`, { method: 'DELETE', credentials: 'include' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || 'Unable to delete the project.');
      setPending(false);
      return;
    }
    router.push('/ops/projects/resale');
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ProjectsTabs />
        <Link href="/ops/projects/resale" className="text-sm font-medium text-slate-500 hover:text-orange-700">Back to resale inventory</Link>
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {loading ? <Notice tone="info">Loading project…</Notice> : null}
      {missing ? <Notice tone="info">This resale project is not in the inventory.</Notice> : null}
      {project && editing ? (
        <form onSubmit={save} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
          <Field label="Name"><Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required aria-label="Project name" /></Field>
          <Field label="Developer"><Input value={draft.developer} onChange={(event) => setDraft({ ...draft, developer: event.target.value })} aria-label="Developer" /></Field>
          <Field label="Locality"><Input value={draft.locality} onChange={(event) => setDraft({ ...draft, locality: event.target.value })} aria-label="Locality" /></Field>
          <Field label="MahaRERA"><Input value={draft.maharera} onChange={(event) => setDraft({ ...draft, maharera: event.target.value })} aria-label="MahaRERA" /></Field>
          <Field label="Towers, one per line"><Textarea value={draft.towers} onChange={(event) => setDraft({ ...draft, towers: event.target.value })} aria-label="Towers" /></Field>
          <Field label="USPs, one per line"><Textarea value={draft.usps} onChange={(event) => setDraft({ ...draft, usps: event.target.value })} aria-label="USPs" /></Field>
          <Field label="Amenities, one per line"><Textarea value={draft.amenities} onChange={(event) => setDraft({ ...draft, amenities: event.target.value })} aria-label="Amenities" /></Field>
          <Field label="Notes"><Textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} aria-label="Notes" /></Field>
          <Field label="Source links"><Textarea value={draft.sourceLinks} onChange={(event) => setDraft({ ...draft, sourceLinks: event.target.value })} aria-label="Source links" /></Field>
          <div className="flex gap-2 md:col-span-2">
            <Button type="submit" disabled={pending}>Save project</Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </form>
      ) : null}
      {project && !editing ? (
        <article className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{project.name}</h2>
              <p className="mt-1 text-sm text-slate-600">{project.developer || 'Developer not recorded'} · {project.locality || 'Locality not recorded'}</p>
            </div>
            <Pill>Resale focus</Pill>
          </div>
          {canManage ? (
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={() => setEditing(true)}>Edit</Button>
              <Button type="button" size="sm" variant="destructive" disabled={pending} onClick={remove}>Delete</Button>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Fact label="MahaRERA" value={project.maharera} />
            <Fact label="Towers" value={project.towers.join(', ')} />
            <Fact label="Notes" value={project.notes} />
          </div>
          <Bullet title="USPs" items={project.usps} />
          <Bullet title="Amenities" items={project.amenities} />
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Sources</h3>
            {project.sourceLinks.length === 0 ? <p className="mt-2 text-sm text-slate-500">No source links.</p> : (
              <ul className="mt-2 space-y-1 text-sm">
                {project.sourceLinks.map((link) => <li key={link}><a className="break-all text-orange-700 hover:underline" href={link} target="_blank" rel="noreferrer">{link}</a></li>)}
              </ul>
            )}
          </section>
          <p className="text-xs text-slate-500">Last updated by {project.lastUpdatedBy || '—'} at {formatWhen(project.lastUpdatedAt)}</p>
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-900">Units</h3>
            {!canSeeSensitive ? <p className="text-sm text-slate-500">Flat numbers and owner contacts are hidden for this role.</p> : null}
            {units.length === 0 ? <p className="text-sm text-slate-500">No units in this project yet.</p> : (
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {units.map((unit) => (
                  <Link key={unit.id} href={`/ops/projects/resale/units/${unit.slug}`} className="grid gap-2 px-3 py-3 text-sm hover:bg-slate-50 sm:grid-cols-5">
                    <span className="font-medium text-slate-900">{unit.tower ? `Tower ${unit.tower}` : 'Tower not set'}</span>
                    <span>{unit.bhk ? `${unit.bhk} BHK` : '—'}</span>
                    <span>{unit.carpetSqft ? `${unit.carpetSqft.toLocaleString('en-IN')} sq ft` : '—'}</span>
                    <span>{unit.floorBand || '—'}</span>
                    <span className="flex items-center justify-between gap-2">
                      <span>{unit.askingPriceLabel || formatCrore(unit.askingPriceCrore)}</span>
                      <Pill tone={unit.status === 'available' ? 'emerald' : 'slate'}>{RESALE_UNIT_STATUS_LABELS[unit.status]} · {LISTING_TYPE_LABELS[unit.listingType]}</Pill>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </article>
      ) : null}
    </div>
  );
}

function Bullet({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      {items.length === 0 ? <p className="mt-2 text-sm text-slate-500">None recorded.</p> : (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">{items.map((item) => <li key={item}>{item}</li>)}</ul>
      )}
    </section>
  );
}
