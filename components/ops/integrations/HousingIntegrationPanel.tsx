'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plug, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { HousingConnectorStatusSnapshot, HousingSyncLogRecord } from '@/lib/ops/integrations/housing/housing.types';

function formatWhen(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return value;
  }
}

function formatDuration(ms: number | null | undefined) {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function connectionLabel(status: HousingConnectorStatusSnapshot['connectionStatus']) {
  if (status === 'connected') return 'Connected';
  if (status === 'misconfigured') return 'Not Configured';
  return 'Not Connected';
}

function connectionClass(status: HousingConnectorStatusSnapshot['connectionStatus']) {
  if (status === 'connected') return 'bg-emerald-100 text-emerald-800';
  if (status === 'misconfigured') return 'bg-amber-100 text-amber-800';
  return 'bg-rose-100 text-rose-800';
}

function formatHttpStatus(status: number | null | undefined) {
  if (status == null || status === 0) return '—';
  return String(status);
}

type MetricCardProps = { label: string; value: string | number };

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function HousingIntegrationPanel() {
  const [status, setStatus] = useState<HousingConnectorStatusSnapshot | null>(null);
  const [logs, setLogs] = useState<HousingSyncLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statusRes, logsRes] = await Promise.all([
        fetch('/api/ops/integrations/housing/status', { credentials: 'include' }),
        fetch('/api/ops/integrations/housing/logs?limit=10', { credentials: 'include' }),
      ]);
      const statusData = await statusRes.json().catch(() => ({}));
      const logsData = await logsRes.json().catch(() => ({}));
      if (!statusRes.ok) {
        setError(statusData.error || 'Unable to load connector status.');
        return;
      }
      setStatus(statusData);
      if (logsRes.ok) setLogs(logsData.logs || []);
    } catch {
      setError('Unable to load Housing.com integration.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSync() {
    setSyncing(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/ops/integrations/housing/sync', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Sync failed.');
        return;
      }
      if (!data.success) {
        if (data.partial) {
          setError(
            data.error
              || `Partial sync — ${data.imported ?? 0} imported, ${data.updated ?? 0} updated, ${data.failed ?? 0} failed, ${data.leadsFetched ?? 0} fetched.`,
          );
        } else {
          setError(data.error || 'Sync failed — Housing API authentication or fetch error.');
        }
      } else if (data.zeroResult || data.leadsFetched === 0) {
        setNotice(
          `Sync completed with zero leads — Housing returned no records for the requested window`
          + `${data.chunksAttempted != null ? ` (${data.chunksCompleted ?? 0}/${data.chunksAttempted} chunks).` : '.'}`,
        );
      } else {
        setNotice(
          `Sync successful — ${data.imported} imported, ${data.updated} updated, ${data.leadsFetched} fetched`
          + `${data.chunksAttempted != null ? `, ${data.chunksCompleted ?? 0}/${data.chunksAttempted} chunks.` : '.'}`,
        );
      }
      await load();
    } catch {
      setError('Sync failed.');
    } finally {
      setSyncing(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/ops/integrations/housing/test', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Connection test failed.');
        return;
      }
      if (!data.success) {
        setError(data.error || 'Housing API credentials could not be verified.');
      } else {
        const available = typeof data.leadsAvailable === 'number' ? data.leadsAvailable : null;
        setNotice(
          `Connection successful (HTTP ${data.apiResponseStatus ?? 200}).`
          + (available == null
            ? ' No leads were imported.'
            : available === 0
              ? ' Test window returned zero leads. No leads were imported.'
              : ` Test window saw ${available} lead(s). No leads were imported.`),
        );
      }
      await load();
    } catch {
      setError('Connection test failed.');
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
        Loading Housing.com connector…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Housing.com API Connector</h2>
            {status ? (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${connectionClass(status.connectionStatus)}`}>
                {connectionLabel(status.connectionStatus)}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Read-only demand ingestion into the unified pipeline. Raw payloads are preserved in{' '}
            <code className="rounded bg-slate-100 px-1">ops_housing_raw</code>.
          </p>
          {status?.message ? (
            <p className="mt-2 text-sm text-amber-700">{status.message}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleTestConnection} disabled={testing || syncing || !status?.configured}>
            <Plug className={`mr-2 h-4 w-4 ${testing ? 'animate-pulse' : ''}`} />
            {testing ? 'Testing…' : 'Test Connection'}
          </Button>
          <Button onClick={handleSync} disabled={syncing || testing || !status?.configured}>
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Manual Sync'}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      ) : null}

      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>
      ) : null}

      {status ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Connection" value={connectionLabel(status.connectionStatus)} />
          <MetricCard label="Last Successful Sync" value={formatWhen(status.lastSuccessfulSyncAt)} />
          <MetricCard label="Leads Imported (Last Sync)" value={status.leadsImportedLastSync ?? '—'} />
          <MetricCard label="Total Housing Leads" value={status.totalLeads} />
          <MetricCard label="API Response Status" value={formatHttpStatus(status.apiResponseStatus)} />
          <MetricCard label="Last Sync" value={formatWhen(status.lastSyncAt)} />
          <MetricCard label="Imported Today" value={status.importedToday} />
          <MetricCard label="Updated Today" value={status.updatedToday} />
          <MetricCard label="Failed Records" value={status.failedRecords} />
          <MetricCard label="Last Sync Duration" value={formatDuration(status.lastSyncDurationMs)} />
        </div>
      ) : null}

      {status?.lastErrorMessage ? (
        <Card className="border-rose-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-rose-800">Last Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-rose-700">{status.lastErrorMessage}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Sync History</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 font-medium">Started</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">HTTP</th>
                <th className="px-3 py-2 font-medium">Fetched</th>
                <th className="px-3 py-2 font-medium">Imported</th>
                <th className="px-3 py-2 font-medium">Updated</th>
                <th className="px-3 py-2 font-medium">Failed</th>
                <th className="px-3 py-2 font-medium">Duration</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                    No sync runs yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-3 whitespace-nowrap">{formatWhen(log.startedAt)}</td>
                    <td className="px-3 py-3 capitalize">{log.kind || 'sync'}</td>
                    <td className="px-3 py-3 capitalize">{log.status}</td>
                    <td className="px-3 py-3">{formatHttpStatus(log.apiResponseStatus)}</td>
                    <td className="px-3 py-3">{log.leadsFetched}</td>
                    <td className="px-3 py-3">{log.imported}</td>
                    <td className="px-3 py-3">{log.updated}</td>
                    <td className="px-3 py-3">{log.failed}</td>
                    <td className="px-3 py-3">{formatDuration(log.durationMs)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
