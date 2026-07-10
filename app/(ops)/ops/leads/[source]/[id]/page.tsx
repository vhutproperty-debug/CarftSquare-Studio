'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import OpsShell from '@/components/ops/OpsShell';
import LeadDetail from '@/components/ops/leads/LeadDetail';
import type { CallTargetSummary, OpsCallActivity } from '@/lib/ops/calls/types';
import type { NormalizedOpsLead } from '@/lib/ops/leads/types';

export default function OpsLeadDetailPage() {
  const params = useParams<{ source: string; id: string }>();
  const [lead, setLead] = useState<NormalizedOpsLead | null>(null);
  const [callSummary, setCallSummary] = useState<CallTargetSummary | null>(null);
  const [callActivities, setCallActivities] = useState<OpsCallActivity[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id?: string; role?: string; isSuperAdmin?: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/auth/status', { credentials: 'include' })
      .then((response) => response.json())
      .then((data) => setCurrentUser(data.user || null))
      .catch(() => setCurrentUser(null));
  }, []);

  useEffect(() => {
    async function load() {
      const source = params.source;
      const id = params.id;
      if (!source || !id) return;

      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/ops/leads/${source}/${id}`, { credentials: 'include' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(data.error || 'Lead not found.');
          return;
        }
        setLead(data.lead);
        setCallSummary(data.callSummary);
        setCallActivities(data.callActivities || []);
      } catch {
        setError('Unable to load lead.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id, params.source]);

  return (
    <OpsShell title="Lead detail" subtitle="Read-only lead view with separate call activity tracking.">
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
          Loading lead…
        </div>
      ) : null}
      {!loading && error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-6 py-8 text-sm text-rose-800">
          {error}
        </div>
      ) : null}
      {!loading && lead && callSummary ? (
        <LeadDetail
          lead={lead}
          callSummary={callSummary}
          callActivities={callActivities}
          currentUser={currentUser}
          onCallContextChange={({ summary, activities }) => {
            setCallSummary(summary);
            setCallActivities(activities);
          }}
        />
      ) : null}
    </OpsShell>
  );
}
