'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PortfolioOwner, PublicPortfolioOwner } from '@/lib/ops/portfolio/types';

type Row = PortfolioOwner | PublicPortfolioOwner;

const selectClass = 'h-9 rounded-md border border-slate-200 bg-white px-2 text-sm';

function phoneOf(row: Row): string {
  if ('phone_masked' in row && row.phone_masked) return row.phone_masked;
  return 'phone_e164' in row ? row.phone_e164 : '—';
}

export default function PortfolioWorkspace() {
  const [q, setQ] = useState('');
  const [project, setProject] = useState('');
  const [priority, setPriority] = useState('');
  const [flags, setFlags] = useState({ nri: false, company: false, broker: false, suspected: false, cross: false });
  const [items, setItems] = useState<Row[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [canSeePrivate, setCanSeePrivate] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (project) params.set('project', project);
    if (priority) params.set('priority', priority);
    if (flags.nri) params.set('nri', '1');
    if (flags.company) params.set('company', '1');
    if (flags.broker) params.set('broker', '1');
    if (flags.suspected) params.set('suspected', '1');
    if (flags.cross) params.set('cross', '1');
    const response = await fetch(`/api/ops/portfolio-owners?${params}`, { credentials: 'include' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || 'Unable to load owners.');
      return;
    }
    setItems(body.items || []);
    setProjects(body.projects || []);
    setCanSeePrivate(Boolean(body.canSeePrivate));
    setError('');
  }, [flags, priority, project, q]);

  useEffect(() => {
    const timer = setTimeout(() => { load(); }, 200);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Owners with two or more flats. Non-admin roles see a masked name and phone. This list is not public.
        {canSeePrivate ? ' You can see full contact details.' : ''}
      </p>
      <div className="flex flex-wrap gap-2">
        <input className={`${selectClass} px-3`} aria-label="Search owners" placeholder="Search" value={q} onChange={(event) => setQ(event.target.value)} />
        <select className={selectClass} aria-label="Project" value={project} onChange={(event) => setProject(event.target.value)}>
          <option value="">All projects</option>
          {projects.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select className={selectClass} aria-label="Priority" value={priority} onChange={(event) => setPriority(event.target.value)}>
          <option value="">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        {([
          ['nri', 'NRI'],
          ['company', 'Company'],
          ['broker', 'Broker'],
          ['suspected', 'Suspected broker'],
          ['cross', 'Cross-project'],
        ] as const).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
            <input type="checkbox" checked={flags[key]} onChange={(event) => setFlags({ ...flags, [key]: event.target.checked })} />
            {label}
          </label>
        ))}
      </div>
      {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((owner) => (
          <article key={owner.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold text-slate-900">{owner.name}</h2>
                <p className="text-sm text-slate-600">{phoneOf(owner)}</p>
              </div>
              <p className="text-xs font-bold uppercase text-slate-500">{owner.priority || 'No priority'}</p>
            </div>
            <div className="mt-2 flex flex-wrap gap-1 text-[11px] font-semibold">
              {owner.nri ? <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-800">NRI</span> : null}
              {owner.company ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">Company</span> : null}
              {owner.broker ? <span className="rounded-full bg-orange-50 px-2 py-0.5 text-orange-800">Broker</span> : null}
              {owner.suspected_broker ? <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-800">Suspected broker</span> : null}
              {owner.projects.length > 1 ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800">Cross-project</span> : null}
            </div>
            <ul className="mt-3 space-y-1 text-sm text-slate-700">
              {owner.flats.map((flat) => (
                <li key={`${flat.project}-${flat.tower}-${flat.flat}`}>{flat.project} · Tower {flat.tower || '—'} · Floor {flat.floor || '—'} · {flat.flat || 'Flat not set'}</li>
              ))}
            </ul>
            {owner.notes ? <p className="mt-2 text-sm text-slate-600">{owner.notes}</p> : null}
          </article>
        ))}
      </div>
      {items.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">No owners with two or more flats match these filters.</p> : null}
    </div>
  );
}
