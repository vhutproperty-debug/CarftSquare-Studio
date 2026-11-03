'use client';

import { useEffect, useState } from 'react';

type Profile = {
  id: string;
  contactId: string;
  configuration: string;
  location: string;
  possession: string;
  intent: string;
  budgetMin: number | null;
  budgetMax: number | null;
  requirementId: string;
};

type Match = { id: string; name: string; reasons: string[] };

export default function DemandProfilerDesk() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [form, setForm] = useState({ configuration: '', location: '', possession: '', intent: '', budgetMin: '', budgetMax: '', contactId: '' });
  const [error, setError] = useState('');

  async function load() {
    const response = await fetch('/api/ops/growth/demand', { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || 'Could not load demand profiles.');
      return;
    }
    setProfiles(data.profiles || []);
  }

  useEffect(() => { load(); }, []);

  async function save() {
    setError('');
    const response = await fetch('/api/ops/growth/demand', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        budgetMin: form.budgetMin ? Number(form.budgetMin) : undefined,
        budgetMax: form.budgetMax ? Number(form.budgetMax) : undefined,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || 'Could not save the profile.');
      return;
    }
    await load();
  }

  async function showMatches(id: string) {
    const response = await fetch(`/api/ops/growth/demand?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    setMatches(data.matches || []);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Map form answers or type the requirement. Matching uses filters. The linked contact row is not edited.</p>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <div className="grid gap-2 rounded-md border border-slate-200 bg-white p-3 sm:grid-cols-2">
        {(['configuration', 'location', 'possession', 'intent', 'budgetMin', 'budgetMax', 'contactId'] as const).map((key) => (
          <input key={key} className="rounded border px-2 py-1 text-sm" placeholder={key} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
        ))}
        <button type="button" className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white" onClick={save}>Save profile</button>
      </div>
      <ul className="space-y-2">
        {profiles.map((profile) => (
          <li key={profile.id} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
            <button type="button" className="font-semibold" onClick={() => showMatches(profile.id)}>
              {[profile.configuration, profile.location, profile.intent].filter(Boolean).join(' · ') || 'Profile'}
            </button>
            <p className="text-slate-500">Contact {profile.contactId || '—'} · Requirement {profile.requirementId}</p>
          </li>
        ))}
      </ul>
      {matches.length ? (
        <ul className="space-y-1 text-sm">
          {matches.map((match) => <li key={match.id}>{match.name}: {match.reasons.join(' ')}</li>)}
        </ul>
      ) : null}
    </div>
  );
}
