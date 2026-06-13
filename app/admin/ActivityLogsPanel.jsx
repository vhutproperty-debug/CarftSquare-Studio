'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, RefreshCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ACTION_LABELS_EXTENDED,
  MODULE_LABELS,
  adminApiFetch,
  formatDateTime,
  isSuperAdmin,
} from '@/lib/auth/rbac/client';

const ACTION_OPTIONS = [
  'all',
  'login',
  'logout',
  'create',
  'edit',
  'delete',
  'publish',
  'archive',
  'permission_change',
  'reset_password',
  'admin_creation',
  'admin_deletion',
  'suspension',
  'activation',
];

export default function ActivityLogsPanel({ currentUser, onMessage }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '200' });
    if (search.trim()) params.set('q', search.trim());
    if (actionFilter !== 'all') params.set('action', actionFilter);
    if (moduleFilter !== 'all') params.set('module', moduleFilter);

    const { response, data, forbidden, failed } = await adminApiFetch(`/api/admin/rbac/activity-logs?${params}`);
    setLoading(false);

    if (failed) {
      onMessage?.(data.error || 'Could not reach activity logs API.');
      return;
    }

    if (forbidden) {
      onMessage?.('Access denied. Super Admin required.');
      return;
    }
    if (!response.ok) {
      onMessage?.(data.error || 'Could not load activity logs.');
      return;
    }
    setLogs(data.logs || []);
  }, [actionFilter, moduleFilter, onMessage, search]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

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
              <ClipboardList className="h-5 w-5 text-orange-600" /> Activity Logs
            </CardTitle>
            <p className="mt-2 text-sm text-slate-500">
              Searchable audit trail for logins, permission changes, admin actions, and module activity.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={loadLogs} disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="relative md:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search user, action, module..."
              className="pl-10"
            />
          </div>
          <select
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
            className="h-10 rounded-md border border-slate-200 px-3 text-sm font-bold"
          >
            {ACTION_OPTIONS.map((action) => (
              <option key={action} value={action}>
                {action === 'all' ? 'All actions' : ACTION_LABELS_EXTENDED[action] || action}
              </option>
            ))}
          </select>
          <select
            value={moduleFilter}
            onChange={(event) => setModuleFilter(event.target.value)}
            className="h-10 rounded-md border border-slate-200 px-3 text-sm font-bold"
          >
            <option value="all">All modules</option>
            <option value="admin">Admin</option>
            <option value="auth">Auth</option>
            {Object.entries(MODULE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading activity logs...</p>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="rounded-2xl border border-slate-100 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black text-slate-950">{log.actorEmail}</p>
                  <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">
                    {ACTION_LABELS_EXTENDED[log.action] || log.action}
                  </Badge>
                  <Badge variant="outline">{MODULE_LABELS[log.module] || log.module}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Resource: {log.resource}{log.resourceId ? ` · ${log.resourceId}` : ''}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {formatDateTime(log.createdAt)}
                  {log.ip ? ` · IP ${log.ip}` : ''}
                </p>
                {log.userAgent && (
                  <p className="mt-1 truncate text-xs text-slate-400" title={log.userAgent}>{log.userAgent}</p>
                )}
                {log.details && Object.keys(log.details).length > 0 && (
                  <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                )}
              </div>
            ))}
            {!logs.length && (
              <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                No activity logs match your filters.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
