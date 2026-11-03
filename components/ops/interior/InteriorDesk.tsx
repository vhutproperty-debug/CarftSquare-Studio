'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';

type Project = { id: string; title: string; stage: string; clientName?: string };

export default function InteriorDesk() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const response = await fetch('/api/ops/interior', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Could not load interior projects.');
      return;
    }
    setProjects(data.projects || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const response = await fetch('/api/ops/interior', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Could not save.');
      return;
    }
    setTitle('');
    await load();
  }

  async function advance(id: string, stage: string) {
    await fetch('/api/ops/interior', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stage', id, stage }),
    });
    await load();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Interior jobs for the design team. The public estimate pages are unchanged, and this screen does not call a model.</p>
      <form onSubmit={onSubmit} className="flex gap-2 rounded-xl border border-slate-200 bg-white p-4">
        <input aria-label="Project title" value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="Project title" className="h-10 flex-1 rounded-md border border-slate-200 px-3" />
        <button type="submit" className="rounded-md bg-orange-600 px-3 text-sm font-semibold text-white">Add</button>
      </form>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <ul className="space-y-2">
        {projects.map((project) => (
          <li key={project.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
            <span className="font-semibold">{project.title}</span>
            <span>{project.stage}</span>
            <button type="button" className="rounded border border-slate-300 px-2 py-1" onClick={() => advance(project.id, 'design')}>Move to design</button>
          </li>
        ))}
        {!projects.length ? <li className="text-sm text-slate-500">No interior projects yet.</li> : null}
      </ul>
    </div>
  );
}
