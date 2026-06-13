'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyRound,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Shield,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ACTION_KEYS,
  ACTION_LABELS,
  ADMIN_GRANT_MODULES,
  MODULE_LABELS,
  adminApiFetch,
  emptyPermissionMatrix,
  formatDateTime,
  isSuperAdmin,
  toggleMatrixAction,
  toggleModuleRow,
} from '@/lib/auth/rbac/client';

function PermissionMatrixEditor({ matrix, onChange, disabled = false }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-4 py-3 font-bold">Module</th>
            {ACTION_KEYS.map((action) => (
              <th key={action} className="px-3 py-3 text-center font-bold">{ACTION_LABELS[action]}</th>
            ))}
            <th className="px-3 py-3 text-center font-bold">All</th>
          </tr>
        </thead>
        <tbody>
          {ADMIN_GRANT_MODULES.map((moduleKey) => {
            const row = matrix?.[moduleKey] || {};
            const allGranted = ACTION_KEYS.every((action) => row[action]);
            return (
              <tr key={moduleKey} className="border-t border-slate-100">
                <td className="px-4 py-3 font-bold text-slate-800">{MODULE_LABELS[moduleKey]}</td>
                {ACTION_KEYS.map((action) => (
                  <td key={action} className="px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={Boolean(row[action])}
                      onChange={(event) => onChange(toggleMatrixAction(matrix, moduleKey, action, event.target.checked))}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </td>
                ))}
                <td className="px-3 py-3 text-center">
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={allGranted}
                    onChange={(event) => onChange(toggleModuleRow(matrix, moduleKey, event.target.checked))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function RbacManagementPanel({ currentUser, onMessage }) {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState('list');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [permissions, setPermissions] = useState(emptyPermissionMatrix());
  const [resetPassword, setResetPassword] = useState('');

  const selectedAdmin = useMemo(
    () => admins.find((admin) => admin.id === selectedId) || null,
    [admins, selectedId],
  );

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (statusFilter !== 'all') params.set('status', statusFilter);
    const { response, data, forbidden, failed } = await adminApiFetch(`/api/admin/rbac/admins?${params}`);
    setLoading(false);
    if (failed) {
      onMessage?.(data.error || 'Could not reach admin management API.');
      return;
    }
    if (forbidden) {
      onMessage?.('Access denied. Super Admin required.');
      return;
    }
    if (!response.ok) {
      onMessage?.(data.error || 'Could not load administrators.');
      return;
    }
    setAdmins(data.admins || []);
  }, [onMessage, search, statusFilter]);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  function openCreate() {
    setMode('create');
    setSelectedId(null);
    setForm({ name: '', email: '', password: '' });
    setPermissions(emptyPermissionMatrix());
    setResetPassword('');
  }

  function openEdit(admin) {
    setMode('edit');
    setSelectedId(admin.id);
    setForm({ name: admin.name, email: admin.email, password: '' });
    setPermissions(admin.permissions || emptyPermissionMatrix());
    setResetPassword('');
  }

  async function saveAdmin(event) {
    event?.preventDefault?.();
    setSaving(true);
    onMessage?.('');

    try {
      if (mode === 'create') {
        const { response, data } = await adminApiFetch('/api/admin/rbac/admins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, permissions }),
        });
        if (!response.ok) throw new Error(data.error || 'Could not create admin.');
        onMessage?.('Administrator created successfully.');
        setMode('list');
        await loadAdmins();
        return;
      }

      if (!selectedAdmin) return;

      const { response: updateRes, data: updateData } = await adminApiFetch(`/api/admin/rbac/admins/${selectedAdmin.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email }),
      });
      if (!updateRes.ok) throw new Error(updateData.error || 'Could not update admin.');

      if (!isSuperAdmin(selectedAdmin)) {
        const { response: permRes, data: permData } = await adminApiFetch(`/api/admin/rbac/admins/${selectedAdmin.id}/permissions`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissions }),
        });
        if (!permRes.ok) throw new Error(permData.error || 'Could not assign permissions.');
      }

      if (resetPassword.trim().length >= 8) {
        const { response: passRes, data: passData } = await adminApiFetch(`/api/admin/rbac/admins/${selectedAdmin.id}/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: resetPassword }),
        });
        if (!passRes.ok) throw new Error(passData.error || 'Could not reset password.');
      }

      onMessage?.('Administrator updated successfully.');
      setMode('list');
      setResetPassword('');
      await loadAdmins();
    } catch (error) {
      onMessage?.(error.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function runAction(admin, action) {
    if (!admin) return;
    setSaving(true);
    onMessage?.('');
    try {
      if (action === 'delete') {
        if (!window.confirm(`Delete admin ${admin.email}?`)) return;
        const { response, data } = await adminApiFetch(`/api/admin/rbac/admins/${admin.id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error(data.error || 'Could not delete admin.');
        onMessage?.('Administrator deleted.');
      }
      if (action === 'suspend') {
        const { response, data } = await adminApiFetch(`/api/admin/rbac/admins/${admin.id}/suspend`, { method: 'POST' });
        if (!response.ok) throw new Error(data.error || 'Could not suspend admin.');
        onMessage?.('Administrator suspended.');
      }
      if (action === 'activate') {
        const { response, data } = await adminApiFetch(`/api/admin/rbac/admins/${admin.id}/activate`, { method: 'POST' });
        if (!response.ok) throw new Error(data.error || 'Could not activate admin.');
        onMessage?.('Administrator activated.');
      }
      await loadAdmins();
    } catch (error) {
      onMessage?.(error.message || 'Action failed.');
    } finally {
      setSaving(false);
    }
  }

  if (!isSuperAdmin(currentUser)) {
    return (
      <Card className="border-white/10 bg-white text-slate-950">
        <CardContent className="p-8 text-center text-sm text-slate-500">Super Admin access required.</CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-white/10 bg-white text-slate-950">
      <CardHeader>
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-orange-600" /> Admin Management
            </CardTitle>
            <p className="mt-2 text-sm text-slate-500">
              Create administrators, assign granular permissions, suspend accounts, and reset passwords.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={loadAdmins} disabled={loading}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            <Button type="button" className="bg-orange-600 text-white hover:bg-orange-700" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Create Admin
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {mode === 'list' ? (
          <>
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name or email"
                  className="pl-10"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-10 rounded-md border border-slate-200 px-3 text-sm font-bold"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            {loading ? (
              <p className="text-sm text-slate-500">Loading administrators...</p>
            ) : (
              <div className="space-y-3">
                {admins.map((admin) => (
                  <div key={admin.id} className="grid gap-3 rounded-2xl border border-slate-100 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-slate-950">{admin.name}</p>
                        <Badge className={admin.role === 'super_admin' ? 'bg-purple-600 text-white hover:bg-purple-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-200'}>
                          {admin.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                        </Badge>
                        <Badge className={admin.status === 'suspended' ? 'bg-red-100 text-red-700 hover:bg-red-100' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'}>
                          {admin.status === 'suspended' ? 'Suspended' : 'Active'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{admin.email}</p>
                      <p className="mt-2 text-xs text-slate-400">
                        Created {formatDateTime(admin.createdAt)} · Last login {formatDateTime(admin.lastLoginAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={() => openEdit(admin)}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                      </Button>
                      {admin.role !== 'super_admin' && admin.id !== currentUser?.id && (
                        <>
                          {admin.status === 'suspended' ? (
                            <Button type="button" variant="outline" onClick={() => runAction(admin, 'activate')} disabled={saving}>
                              <UserCheck className="mr-2 h-4 w-4" /> Activate
                            </Button>
                          ) : (
                            <Button type="button" variant="outline" onClick={() => runAction(admin, 'suspend')} disabled={saving}>
                              <UserX className="mr-2 h-4 w-4" /> Suspend
                            </Button>
                          )}
                          <Button type="button" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => runAction(admin, 'delete')} disabled={saving}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {!admins.length && (
                  <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                    No administrators match your filters.
                  </p>
                )}
              </div>
            )}
          </>
        ) : (
          <form onSubmit={saveAdmin} className="space-y-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-black">{mode === 'create' ? 'Create Administrator' : 'Edit Administrator'}</h3>
              <Button type="button" variant="outline" onClick={() => setMode('list')}>Back to list</Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-bold">
                Name
                <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
              </label>
              <label className="space-y-2 text-sm font-bold">
                Email
                <Input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
              </label>
              {mode === 'create' && (
                <label className="space-y-2 text-sm font-bold md:col-span-2">
                  Password
                  <Input type="password" minLength={8} value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required />
                </label>
              )}
              {mode === 'edit' && (
                <label className="space-y-2 text-sm font-bold md:col-span-2">
                  Reset Password (optional)
                  <Input type="password" minLength={8} value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} placeholder="Leave blank to keep current password" />
                </label>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-orange-600" />
                <h4 className="font-black">Permission Matrix</h4>
              </div>
              {mode === 'edit' && isSuperAdmin(selectedAdmin) ? (
                <p className="rounded-2xl bg-purple-50 p-4 text-sm text-purple-800">
                  Super Admin accounts always have full access and cannot be restricted.
                </p>
              ) : (
                <PermissionMatrixEditor matrix={permissions} onChange={setPermissions} />
              )}
            </div>

            <Button type="submit" disabled={saving} className="bg-orange-600 font-black text-white hover:bg-orange-700">
              {saving ? 'Saving...' : mode === 'create' ? 'Create Administrator' : 'Save Changes'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
