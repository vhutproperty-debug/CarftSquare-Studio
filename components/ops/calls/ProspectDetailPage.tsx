'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import OpsShell from '@/components/ops/OpsShell';
import CallActionsPanel from '@/components/ops/calls/CallActionsPanel';
import CallHistoryTimeline from '@/components/ops/calls/CallHistoryTimeline';
import CallStatusBadge from '@/components/ops/calls/CallStatusBadge';
import type { CallTargetSummary, OpsCallActivity, OpsProspect } from '@/lib/ops/calls/types';
import { formatPhoneDisplay, buildWhatsAppLink } from '@/lib/ops/phone';
import { MessageCircle } from 'lucide-react';

export default function ProspectDetailPage() {
  const params = useParams<{ id: string }>();
  const [prospect, setProspect] = useState<OpsProspect | null>(null);
  const [summary, setSummary] = useState<CallTargetSummary | null>(null);
  const [activities, setActivities] = useState<OpsCallActivity[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id?: string; role?: string; isSuperAdmin?: boolean } | null>(null);
  const [notes, setNotes] = useState('');
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
      if (!params.id) return;
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/ops/prospects/${params.id}`, { credentials: 'include' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(data.error || 'Prospect not found.');
          return;
        }
        setProspect(data.prospect);
        setSummary(data.summary);
        setActivities(data.activities || []);
        setNotes(data.prospect?.notes || '');
      } catch {
        setError('Unable to load prospect.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  async function saveNotes() {
    if (!prospect) return;
    const response = await fetch(`/api/ops/prospects/${prospect.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) setProspect(data.prospect);
  }

  const whatsappLink = prospect ? buildWhatsAppLink(
    prospect.phone,
    `Hi ${prospect.name || 'there'}, this is CraftSquare Studio.`,
  ) : null;

  return (
    <OpsShell title="Prospect detail" subtitle="Cold-call prospect and call history.">
      <Button asChild variant="ghost" size="sm" className="mb-4 px-0 text-slate-600">
        <Link href="/ops/calls">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          Back to calls
        </Link>
      </Button>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
          Loading prospect…
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-6 py-8 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {prospect && summary ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CallStatusBadge status={summary.currentStatus} />
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">
                  {prospect.prospectType.replace(/_/g, ' ')}
                </span>
              </div>
              <CardTitle className="text-2xl">{prospect.name || 'Unknown prospect'}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <DetailItem label="Phone" value={formatPhoneDisplay(prospect.phone)} />
              <DetailItem label="Alternate phone" value={formatPhoneDisplay(prospect.alternatePhone)} />
              <DetailItem label="Email" value={prospect.email} />
              <DetailItem label="Project" value={prospect.projectName} />
              <DetailItem label="Building" value={prospect.building} />
              <DetailItem label="Unit" value={prospect.unit} />
              <DetailItem label="Location" value={prospect.location} />
              <DetailItem label="Requirement" value={prospect.requirement} />
              <DetailItem label="Source" value={prospect.source.replace(/_/g, ' ')} />
            </CardContent>
          </Card>

          <CallActionsPanel
            targetType="ops_prospect"
            targetId={prospect.id}
            phone={prospect.phone}
            whatsappMessage={`Hi ${prospect.name || 'there'}, this is CraftSquare Studio.`}
            callSummary={summary}
            callActivities={activities}
            currentUser={currentUser}
            onCallContextChange={({ summary: nextSummary, activities: nextActivities }) => {
              setSummary(nextSummary);
              setActivities(nextActivities);
              setProspect((current) => current ? {
                ...current,
                callStatus: nextSummary.currentStatus,
                nextFollowUpAt: nextSummary.nextFollowUpAt || undefined,
                phoneInvalid: nextSummary.wrongNumber,
              } : current);
            }}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
              />
              <div className="flex gap-2">
                <Button type="button" onClick={saveNotes}>Save Note</Button>
                {whatsappLink && !summary.doNotCall ? (
                  <Button asChild variant="outline">
                    <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                      WhatsApp
                    </a>
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Call history</CardTitle>
            </CardHeader>
            <CardContent>
              <CallHistoryTimeline activities={activities} />
            </CardContent>
          </Card>
        </div>
      ) : null}
    </OpsShell>
  );
}

function DetailItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-900">{value?.trim() ? value : '—'}</dd>
    </div>
  );
}
