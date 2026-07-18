'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { OpsProjectAlias, OpsUnknownProjectSighting } from '@/lib/ops/brokers/types';

export default function BrokerProjectsPanel() {
  const [aliases, setAliases] = useState<OpsProjectAlias[]>([]);
  const [unknown, setUnknown] = useState<OpsUnknownProjectSighting[]>([]);
  const [canonical, setCanonical] = useState('');
  const [aliasText, setAliasText] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ops/brokers/projects', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Unable to load projects.');
        return;
      }
      setAliases(data.aliases || []);
      setUnknown(data.unknownProjects || []);
    } catch {
      setError('Unable to load projects.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createAlias() {
    if (!canonical.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/ops/brokers/projects', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canonicalProject: canonical.trim(),
          aliases: aliasText.split(',').map((s) => s.trim()).filter(Boolean),
          city: 'Mumbai',
        }),
      });
      setCanonical('');
      setAliasText('');
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="rounded-xl border bg-white p-6 text-sm text-slate-500">Loading projects…</div>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {error ? (
        <div className="lg:col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Project aliases</h3>
        <div className="rounded-xl border bg-white p-4 space-y-2">
          <Input placeholder="Canonical project" value={canonical} onChange={(e) => setCanonical(e.target.value)} />
          <Input placeholder="Aliases (comma separated)" value={aliasText} onChange={(e) => setAliasText(e.target.value)} />
          <Button size="sm" onClick={createAlias} disabled={saving}>Add alias</Button>
        </div>
        <div className="max-h-[420px] space-y-2 overflow-y-auto">
          {aliases.map((a) => (
            <div key={a.id} className="rounded-lg border bg-white px-3 py-2 text-sm">
              <p className="font-semibold text-slate-900">{a.canonicalProject}</p>
              <p className="text-xs text-slate-500">{a.aliases.join(' · ') || 'No aliases'}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Unmapped projects</h3>
        <p className="text-xs text-slate-500">Unknown names are tracked for review — aliases are never auto-created.</p>
        <div className="max-h-[480px] space-y-2 overflow-y-auto">
          {unknown.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm">
              <span className="font-medium text-slate-800">{u.projectName}</span>
              <span className="text-xs text-slate-500">{u.count}×</span>
            </div>
          ))}
          {!unknown.length ? (
            <p className="text-sm text-slate-500">No unmapped projects yet.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
