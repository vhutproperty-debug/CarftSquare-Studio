'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CallActionsPanel from '@/components/ops/calls/CallActionsPanel';
import CallHistoryTimeline from '@/components/ops/calls/CallHistoryTimeline';
import LeadSourceBadge, { LeadCategoryBadge } from '@/components/ops/leads/LeadSourceBadge';
import LeadStatusBadge from '@/components/ops/leads/LeadStatusBadge';
import type { CallTargetSummary, OpsCallActivity } from '@/lib/ops/calls/types';
import type { NormalizedOpsLead } from '@/lib/ops/leads/types';
import { OPS_LEAD_SOURCE_LABELS } from '@/lib/ops/leads/types';
import { formatPhoneDisplay } from '@/lib/ops/phone';

function formatReceivedAt(value: string) {
  try {
    return new Date(value).toLocaleString('en-IN', {
      dateStyle: 'full',
      timeStyle: 'short',
    });
  } catch {
    return value;
  }
}

function whatsAppPrefill(lead: NormalizedOpsLead) {
  const name = lead.name || 'there';
  const sourceLabel = OPS_LEAD_SOURCE_LABELS[lead.source];
  return `Hi, this is CraftSquare Studio regarding your ${sourceLabel} enquiry, ${name}.`;
}

type LeadDetailProps = {
  lead: NormalizedOpsLead;
  callSummary: CallTargetSummary;
  callActivities: OpsCallActivity[];
  currentUser?: { id?: string; role?: string; isSuperAdmin?: boolean } | null;
  onCallContextChange: (payload: {
    summary: CallTargetSummary;
    activities: OpsCallActivity[];
  }) => void;
};

export default function LeadDetail({
  lead,
  callSummary,
  callActivities,
  currentUser,
  onCallContextChange,
}: LeadDetailProps) {
  const rawEntries = Object.entries(lead.rawSummary || {});

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="px-0 text-slate-600">
        <Link href="/ops/leads">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          Back to inbox
        </Link>
      </Button>

      <CallActionsPanel
        targetType="unified_lead"
        targetSource={lead.source}
        targetId={lead.sourceId}
        phone={lead.phone}
        whatsappMessage={whatsAppPrefill(lead)}
        callSummary={callSummary}
        callActivities={callActivities}
        currentUser={currentUser}
        onCallContextChange={onCallContextChange}
      />

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <LeadSourceBadge source={lead.source} />
            <LeadCategoryBadge category={lead.category} />
            <LeadStatusBadge status={lead.sourceStatus} />
          </div>
          <CardTitle className="text-2xl">{lead.name || 'Unknown lead'}</CardTitle>
          <p className="text-sm text-slate-500">Received {formatReceivedAt(lead.createdAt)}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Contact</h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">Phone</dt>
                <dd className="text-base font-semibold text-slate-900">{formatPhoneDisplay(lead.phone)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Email</dt>
                <dd className="text-base text-slate-900">{lead.email || '—'}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Lead context</h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <DetailItem label="Project" value={lead.projectName} />
              <DetailItem label="Intent" value={lead.intent} />
              <DetailItem label="Requirement" value={lead.requirement} />
              <DetailItem label="Budget" value={lead.budget != null ? String(lead.budget) : null} />
              <DetailItem label="Location" value={lead.location} />
              <DetailItem label="Source status" value={lead.sourceStatus} />
            </dl>
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Source record</h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <DetailItem label="Source" value={OPS_LEAD_SOURCE_LABELS[lead.source]} />
              <DetailItem label="Collection" value={lead.sourceCollection} />
              <DetailItem label="Record ID" value={lead.sourceId} />
            </dl>
          </section>

          {rawEntries.length ? (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Additional details</h2>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                {rawEntries.map(([key, value]) => (
                  <DetailItem
                    key={key}
                    label={key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())}
                    value={formatRawValue(value)}
                  />
                ))}
              </dl>
            </section>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Call history</CardTitle>
        </CardHeader>
        <CardContent>
          <CallHistoryTimeline activities={callActivities} />
        </CardContent>
      </Card>
    </div>
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

function formatRawValue(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
