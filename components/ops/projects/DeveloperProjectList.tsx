'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DeveloperProjectForm, { developerPayload, emptyDeveloperDraft } from '@/components/ops/projects/DeveloperProjectForm';
import { EmptyState, Notice, Pill, ProjectsTabs, selectClass } from '@/components/ops/projects/ui';
import { formatPsf } from '@/lib/ops/projects/format';
import { DEVELOPER_STATUS_LABELS, DEVELOPER_STATUSES, PRICE_BANDS } from '@/lib/ops/projects/types';
import type { DeveloperProject, DeveloperProjectStatus } from '@/lib/ops/projects/types';

type ListResponse = {
  items: DeveloperProject[];
  filterOptions: { localities: string[]; developers: string[]; bhks: number[] };
  canManage: boolean;
  error?: string;
};

function statusTone(status: DeveloperProjectStatus): 'orange' | 'sky' | 'emerald' | 'slate' | 'rose' {
  if (status === 'new_launch') return 'orange';
  if (status === 'under_construction') return 'sky';
  if (status === 'ready') return 'emerald';
  if (status === 'sold_out') return 'rose';
  return 'slate';
}

export default function DeveloperProjectList() {
  const router = useRouter();
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [locality, setLocality] = useState('');
  const [developer, setDeveloper] = useState('');
  const [status, setStatus] = useState('');
  const [priceBand, setPriceBand] = useState('');
  const [bhk, setBhk] = useState('');
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (locality) params.set('locality', locality);
    if (developer) params.set('developer', developer);
    if (status) params.set('status', status);
    if (priceBand) params.set('priceBand', priceBand);
    if (bhk) params.set('bhk', bhk);
    try {
      const response = await fetch(`/api/ops/projects/developer?${params}`, { credentials: 'include' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error || 'Unable to load developer projects.');
        return;
      }
      setData(body);
    } catch {
      setError('Unable to load developer projects.');
    } finally {
      setLoading(false);
    }
  }, [bhk, developer, locality, priceBand, q, status]);

  useEffect(() => {
    const timer = setTimeout(() => { load(); }, q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, q]);

  async function create(payload: ReturnType<typeof developerPayload>) {
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/ops/projects/developer', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error || 'Unable to add the project.');
        return;
      }
      router.push(`/ops/projects/developer/${body.project.slug}`);
    } catch {
      setError('Unable to add the project.');
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
          <Button type="button" size="sm" onClick={() => setCreating((open) => !open)}>
            {creating ? 'Close form' : 'Add project'}
          </Button>
        ) : null}
      </div>
      <p className="text-sm text-slate-600">
        New launches and under-construction projects bought from the developer. Channel-partner status and sales contacts stay inside ops.
      </p>
      {creating && data?.canManage ? (
        <DeveloperProjectForm initial={emptyDeveloperDraft()} pending={pending} submitLabel="Add project" onSubmit={create} onCancel={() => setCreating(false)} />
      ) : null}
      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search name, RERA, developer" aria-label="Search developer projects" />
        <select className={selectClass} aria-label="Filter by locality" value={locality} onChange={(event) => setLocality(event.target.value)}>
          <option value="">All localities</option>
          {(options?.localities || []).map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select className={selectClass} aria-label="Filter by developer" value={developer} onChange={(event) => setDeveloper(event.target.value)}>
          <option value="">All developers</option>
          {(options?.developers || []).map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select className={selectClass} aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          {DEVELOPER_STATUSES.map((item) => <option key={item} value={item}>{DEVELOPER_STATUS_LABELS[item]}</option>)}
        </select>
        <select className={selectClass} aria-label="Filter by price band" value={priceBand} onChange={(event) => setPriceBand(event.target.value)}>
          <option value="">All prices</option>
          {PRICE_BANDS.map((band) => <option key={band.id} value={band.id}>{band.label}</option>)}
        </select>
        <select className={selectClass} aria-label="Filter by BHK" value={bhk} onChange={(event) => setBhk(event.target.value)}>
          <option value="">All BHK</option>
          {(options?.bhks || []).map((item) => <option key={item} value={String(item)}>{item} BHK</option>)}
        </select>
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {loading && !data ? <Notice tone="info">Loading developer projects…</Notice> : null}
      {data && data.items.length === 0 ? <EmptyState>No developer projects match these filters.</EmptyState> : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(data?.items || []).map((project) => (
          <Link key={project.id} href={`/ops/projects/developer/${project.slug}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-orange-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{project.name}</h2>
                <p className="mt-1 text-sm text-slate-600">{project.developer || 'Developer not recorded'}</p>
              </div>
              <Pill tone={statusTone(project.status)}>{project.statusLabel || DEVELOPER_STATUS_LABELS[project.status]}</Pill>
            </div>
            <dl className="mt-3 space-y-1.5 text-sm text-slate-700">
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Locality</dt><dd className="text-right">{project.locality || '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">MahaRERA</dt><dd className="text-right">{project.maharera || '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Config</dt><dd className="text-right">{project.configLabel || '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Price</dt><dd className="text-right">{project.priceLabel || '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">₹/sqft</dt><dd className="text-right">{formatPsf(project.pricePerSqft, project.pricePerSqftMax)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Possession</dt><dd className="text-right">{project.possession || '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Sales email</dt><dd className="text-right">{project.salesEmail?.value || 'Not recorded'} · {project.salesEmail?.verification === 'verified' ? 'Verified' : 'Unverified'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Sales phone</dt><dd className="text-right">{project.salesPhone?.value || 'Not recorded'} · {project.salesPhone?.verification === 'verified' ? 'Verified' : 'Unverified'}</dd></div>
            </dl>
          </Link>
        ))}
      </div>
    </div>
  );
}
