'use client';

import { useCallback, useEffect, useState } from 'react';
import OpsShell from '@/components/ops/OpsShell';

type Job = {
  id: string;
  status: string;
  templateName: string;
  normalizedPhone: string;
  scheduledFor: string;
  attempt: number;
  lastError?: string;
};

export default function OpsAutomationPage() {
  return (
    <OpsShell
      title="Automation"
      subtitle="Scheduled WhatsApp follow-ups and Interakt integration health."
      workspace
      pipelineStage="demand"
    >
      <AutomationWorkspace />
    </OpsShell>
  );
}

function AutomationWorkspace() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [tickResult, setTickResult] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [jobsRes, statusRes] = await Promise.all([
        fetch('/api/ops/followups', { credentials: 'include' }),
        fetch('/api/ops/whatsapp/status', { credentials: 'include' }),
      ]);
      const jobsData = await jobsRes.json().catch(() => ({}));
      const statusData = await statusRes.json().catch(() => ({}));
      if (!jobsRes.ok) {
        setError(jobsData.error || 'Unable to load follow-ups.');
        return;
      }
      setJobs(jobsData.jobs || []);
      setStatus(statusData.status || null);
    } catch {
      setError('Unable to load automation workspace.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runTick() {
    setTickResult('Running…');
    const res = await fetch('/api/ops/followups/tick', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 10 }),
    });
    const data = await res.json().catch(() => ({}));
    setTickResult(res.ok ? JSON.stringify(data) : data.error || 'Tick failed');
    await load();
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Interakt status</h2>
        {status ? (
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Business WA</dt>
              <dd className="font-medium">{String(status.businessWaNumber || '—')}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Matches production lock</dt>
              <dd className="font-medium">{status.businessWaMatchesProduction ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">API key</dt>
              <dd className="font-medium">{status.apiKeyConfigured ? 'Configured' : 'Missing'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Webhook secret</dt>
              <dd className="font-medium">{status.webhookSecretConfigured ? 'Configured' : 'Missing'}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Loading…</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Follow-up jobs</h2>
          <button
            type="button"
            onClick={runTick}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
          >
            Process due now
          </button>
        </div>
        {tickResult && <p className="mb-2 text-xs text-slate-500">{tickResult}</p>}
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-3">Phone</th>
                <th className="py-2 pr-3">Template</th>
                <th className="py-2 pr-3">Scheduled</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Attempts</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-t border-slate-100">
                  <td className="py-2 pr-3">****{job.normalizedPhone.slice(-4)}</td>
                  <td className="py-2 pr-3">{job.templateName}</td>
                  <td className="py-2 pr-3">{job.scheduledFor}</td>
                  <td className="py-2 pr-3">
                    {job.status}
                    {job.lastError ? ` · ${job.lastError}` : ''}
                  </td>
                  <td className="py-2">{job.attempt}</td>
                </tr>
              ))}
              {!jobs.length && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">
                    No follow-up jobs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
