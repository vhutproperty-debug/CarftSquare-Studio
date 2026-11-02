'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import DeveloperProjectForm, { developerPayload, draftFromDeveloper } from '@/components/ops/projects/DeveloperProjectForm';
import { Fact, Notice, Pill, ProjectsTabs } from '@/components/ops/projects/ui';
import { formatCarpet, formatPsf, formatWhen } from '@/lib/ops/projects/format';
import { CHANNEL_PARTNER_LABELS, DEVELOPER_STATUS_LABELS } from '@/lib/ops/projects/types';
import type { DeveloperProject } from '@/lib/ops/projects/types';

export default function DeveloperProjectDetail({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<DeveloperProject | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/ops/projects/developer/${projectId}`, { credentials: 'include' });
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
        setCanManage(Boolean(body.canManage));
      } catch {
        if (!cancelled) setError('Unable to load the project.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [projectId]);

  async function save(payload: ReturnType<typeof developerPayload>) {
    if (!project) return;
    setPending(true);
    setError('');
    try {
      const response = await fetch(`/api/ops/projects/developer/${project.slug}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
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
    if (!project || !window.confirm(`Delete ${project.name}? This does not affect resale units.`)) return;
    setPending(true);
    setError('');
    try {
      const response = await fetch(`/api/ops/projects/developer/${project.slug}`, { method: 'DELETE', credentials: 'include' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error || 'Unable to delete the project.');
        return;
      }
      router.push('/ops/projects/developer');
    } catch {
      setError('Unable to delete the project.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ProjectsTabs />
        <Link href="/ops/projects/developer" className="text-sm font-medium text-slate-500 hover:text-orange-700">Back to developer inventory</Link>
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {loading ? <Notice tone="info">Loading project…</Notice> : null}
      {missing ? <Notice tone="info">This developer project is not in the inventory.</Notice> : null}
      {project && editing ? (
        <DeveloperProjectForm initial={draftFromDeveloper(project)} pending={pending} submitLabel="Save project" onSubmit={save} onCancel={() => setEditing(false)} />
      ) : null}
      {project && !editing ? (
        <article className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{project.name}</h2>
              <p className="mt-1 text-sm text-slate-600">{project.developer || 'Developer not recorded'} · {project.locality || 'Locality not recorded'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill tone="orange">{project.statusLabel || DEVELOPER_STATUS_LABELS[project.status]}</Pill>
              <Pill>{CHANNEL_PARTNER_LABELS[project.channelPartnerStatus]}</Pill>
            </div>
          </div>
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => setEditing(true)}>Edit</Button>
              <Button type="button" size="sm" variant="destructive" disabled={pending} onClick={remove}>Delete</Button>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Fact label="Address" value={project.address} />
            <Fact label="MahaRERA" value={project.maharera} />
            <Fact label="Configuration and carpet" value={project.configLabel} />
            <Fact label="Carpet" value={formatCarpet(project.carpetMinSqft, project.carpetMaxSqft)} />
            <Fact label="BHK" value={project.bhk.length ? project.bhk.map((item) => `${item} BHK`).join(', ') : ''} />
            <Fact label="Price range" value={project.priceLabel} />
            <Fact label="₹/sqft" value={formatPsf(project.pricePerSqft, project.pricePerSqftMax)} />
            <Fact label="Possession" value={project.possession} />
            <Fact label="Inventory" value={project.inventoryNote} />
            <Fact label="Offer" value={project.offerNote} />
            <Fact label="Brochure" value={project.brochureUrl ? <a className="text-orange-700 underline-offset-2 hover:underline" href={project.brochureUrl} target="_blank" rel="noreferrer">Open brochure</a> : ''} />
          </div>
          <ListBlock title="USPs" items={project.usps} />
          <ListBlock title="Amenities" items={project.amenities} />
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Floor plans</h3>
            {project.floorPlans.length === 0 ? <p className="mt-2 text-sm text-slate-500">No floor plans yet.</p> : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {project.floorPlans.map((plan) => (
                  <a key={plan.id || plan.url} href={plan.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-slate-200">
                    {plan.kind === 'image' ? (
                      // Floor plans are ops uploads or external URLs chosen by an admin.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={plan.url} alt={plan.name} className="h-40 w-full object-cover" />
                    ) : (
                      <div className="flex h-40 items-center justify-center bg-slate-50 text-sm font-medium text-slate-600">PDF</div>
                    )}
                    <p className="px-3 py-2 text-sm text-slate-800">{plan.name}</p>
                  </a>
                ))}
              </div>
            )}
          </section>
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Developer and sales contacts</h3>
            <p className="mt-1 text-sm text-slate-500">Team-visible inside ops. Not shown on the public site.</p>
            {project.contacts.length === 0 ? <p className="mt-2 text-sm text-slate-500">No contacts yet.</p> : (
              <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
                {project.contacts.map((contact, index) => (
                  <li key={`${contact.email}-${contact.phone}-${index}`} className="grid gap-1 px-3 py-2 text-sm sm:grid-cols-4">
                    <span className="font-medium text-slate-900">{contact.name || '—'}</span>
                    <span className="text-slate-600">{contact.role || '—'}</span>
                    <span className="text-slate-700">{contact.phone || '—'}</span>
                    <span className="text-slate-700">{contact.email || '—'}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Notes</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{project.notes || '—'}</p>
          </section>
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Sources</h3>
            {project.sourceLinks.length === 0 ? <p className="mt-2 text-sm text-slate-500">No source links.</p> : (
              <ul className="mt-2 space-y-1 text-sm">
                {project.sourceLinks.map((link) => (
                  <li key={link}><a className="break-all text-orange-700 underline-offset-2 hover:underline" href={link} target="_blank" rel="noreferrer">{link}</a></li>
                ))}
              </ul>
            )}
          </section>
          <p className="text-xs text-slate-500">Last updated by {project.lastUpdatedBy || '—'} at {formatWhen(project.lastUpdatedAt)}</p>
        </article>
      ) : null}
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      {items.length === 0 ? <p className="mt-2 text-sm text-slate-500">None recorded.</p> : (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )}
    </section>
  );
}
