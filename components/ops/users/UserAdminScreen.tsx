'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ASSIGNABLE_ROLES, ROLE_LABELS, adminApiFetch } from '@/lib/auth/rbac/client';

type ListedUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status?: string;
};

const ROLE_HELP: Record<string, string> = {
  admin: 'Existing admin role. Module checkboxes still apply. Ops import, export, edit, and delete stay with the super admin.',
  ops_exec: 'View-only teammate for contacts, supply, and agreements. Can add remarks and fill empty fields. Sees only assigned records.',
  sales_exec: 'View-only teammate for leads and deals. Can add remarks and fill empty fields. Sees only assigned records.',
  interior: 'Interior teammate. Sees the interior workspace and assigned client requirements.',
  broker: 'External broker. Server responses omit owner phones, flat numbers, negotiations, builder commercials, brokerage, and private client data.',
};

export default function UserAdminScreen() {
  const [users, setUsers] = useState<ListedUser[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('ops_exec');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { response, data } = await adminApiFetch('/api/admin/rbac/admins');
    if (!response.ok) {
      setError(typeof data.error === 'string' ? data.error : 'Could not load users.');
      return;
    }
    setUsers((data.admins || []) as ListedUser[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    const { response, data } = await adminApiFetch('/api/admin/rbac/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role, permissions: {} }),
    });
    setSaving(false);
    if (!response.ok) {
      setError(typeof data.error === 'string' ? data.error : 'Could not create the user.');
      return;
    }
    setMessage(`${name.trim()} can sign in as ${ROLE_LABELS[role] || role}.`);
    setName('');
    setEmail('');
    setPassword('');
    await load();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-bold">Add a teammate</h2>
        <form onSubmit={onSubmit} className="mt-3 space-y-3">
          <label className="block text-sm font-semibold">
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3" />
          </label>
          <label className="block text-sm font-semibold">
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3" />
          </label>
          <label className="block text-sm font-semibold">
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3" />
          </label>
          <label className="block text-sm font-semibold">
            Role
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
            >
              {ASSIGNABLE_ROLES.map((item: string) => (
                <option key={item} value={item}>{ROLE_LABELS[item] || item}</option>
              ))}
            </select>
          </label>
          <p className="text-sm text-slate-600">{ROLE_HELP[role]}</p>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
          <button type="submit" disabled={saving} className="rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? 'Saving…' : 'Create user'}
          </button>
        </form>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-bold">People</h2>
        <div className="mt-3 space-y-2">
          {users.map((user) => (
            <div key={user.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2">
              <div>
                <p className="font-semibold">{user.name}</p>
                <p className="text-sm text-slate-500">{user.email}</p>
              </div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-600">{ROLE_LABELS[user.role] || user.role}</p>
            </div>
          ))}
          {!users.length ? <p className="text-sm text-slate-500">No users loaded yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
