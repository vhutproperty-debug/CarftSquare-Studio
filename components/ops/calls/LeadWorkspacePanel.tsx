'use client';

import { useEffect, useState } from 'react';
import { Building2, Calendar, IndianRupee, Mail, MapPin, Phone, Tag, User } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import CallHistoryTimeline from '@/components/ops/calls/CallHistoryTimeline';
import CallStatusBadge from '@/components/ops/calls/CallStatusBadge';
import BusinessTypeBadge from '@/components/ops/BusinessTypeBadge';
import LeadSourceBadge, { LeadCategoryBadge } from '@/components/ops/leads/LeadSourceBadge';
import type { CallTargetSummary, OpsCallActivity, OpsProspect } from '@/lib/ops/calls/types';
import type { NormalizedOpsLead } from '@/lib/ops/leads/types';
import { OPS_LEAD_SOURCE_LABELS } from '@/lib/ops/leads/types';
import { getRecordBusinessType } from '@/lib/ops/business';
import { formatPhoneDisplay } from '@/lib/ops/phone';

function formatWhen(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return value;
  }
}

export type WorkspaceDetail =
  | {
      kind: 'ops_prospect';
      prospect: OpsProspect;
      summary: CallTargetSummary;
      activities: OpsCallActivity[];
    }
  | {
      kind: 'unified_lead';
      lead: NormalizedOpsLead;
      summary: CallTargetSummary;
      activities: OpsCallActivity[];
    };

type LeadWorkspacePanelProps = {
  detail: WorkspaceDetail | null;
  loading: boolean;
  onNotesSaved?: (notes: string) => void;
};

export default function LeadWorkspacePanel({ detail, loading, onNotesSaved }: LeadWorkspacePanelProps) {
  const [notes, setNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    if (detail?.kind === 'ops_prospect') {
      setNotes(detail.prospect.notes || '');
      setNotesDirty(false);
    }
  }, [detail]);

  if (loading) {
    return (
      <section className="flex h-full min-h-0 flex-col items-center justify-center bg-slate-50/50">
        <p className="text-sm text-slate-500">Loading lead workspace…</p>
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="flex h-full min-h-0 flex-col items-center justify-center bg-slate-50/50 px-6 text-center">
        <div className="max-w-sm space-y-2">
          <p className="text-lg font-semibold text-slate-800">Select from the outreach queue</p>
          <p className="text-sm text-slate-500">
            Demand enquiries and supply prospects appear here. Press <kbd className="rounded border bg-white px-1.5 py-0.5 text-xs font-mono">N</kbd> for next.
          </p>
        </div>
      </section>
    );
  }

  const summary = detail.summary;
  const activities = detail.activities;
  const isProspect = detail.kind === 'ops_prospect';
  const prospect = isProspect ? detail.prospect : null;
  const lead = !isProspect ? detail.lead : null;

  const displayName = prospect?.name || lead?.name || 'Unknown';
  const phone = prospect?.phone || lead?.phone;
  const project = prospect?.projectName || lead?.projectName;
  const building = prospect?.building;
  const location = prospect?.location || lead?.location;
  const requirement = prospect?.requirement || lead?.requirement;
  const budget = lead?.budget;
  const email = prospect?.email || lead?.email;
  const intent = lead?.intent;
  const timeline = lead?.createdAt;

  const businessType = getRecordBusinessType(isProspect ? 'ops_prospect' : 'unified_lead');

  const currentNotes = notesDirty ? notes : (prospect?.notes || '');

  async function saveNotes() {
    if (!prospect || !onNotesSaved) return;
    setSavingNotes(true);
    try {
      await onNotesSaved(notes);
      setNotesDirty(false);
    } finally {
      setSavingNotes(false);
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-50/30">
      <header className="shrink-0 border-b border-slate-200/80 bg-white px-5 py-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <BusinessTypeBadge pillar={businessType.pillar} label={businessType.label} size="md" />
          <CallStatusBadge status={summary.currentStatus} />
          {lead ? <LeadSourceBadge source={lead.source} /> : null}
          {lead ? <LeadCategoryBadge category={lead.category} /> : null}
          {prospect ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold capitalize text-slate-700">
              {prospect.prospectType.replace(/_/g, ' ')}
            </span>
          ) : null}
          {summary.doNotCall ? (
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold uppercase text-red-800">DNC</span>
          ) : null}
          {summary.wrongNumber ? (
            <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold uppercase text-rose-800">Invalid</span>
          ) : null}
        </div>

        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{displayName}</h1>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          <a
            href={phone ? `tel:+91${phone.replace(/\D/g, '').slice(-10)}` : undefined}
            className="flex items-center gap-2 text-xl font-bold text-slate-800 hover:text-orange-600"
          >
            <Phone className="h-5 w-5 text-slate-400" aria-hidden="true" />
            {formatPhoneDisplay(phone)}
          </a>
          {email ? (
            <span className="flex items-center gap-1.5 text-sm text-slate-600">
              <Mail className="h-4 w-4" aria-hidden="true" />
              {email}
            </span>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetaChip icon={Building2} label="Project" value={project || building} />
          <MetaChip icon={MapPin} label="Location" value={location} />
          <MetaChip icon={IndianRupee} label="Budget" value={budget != null ? String(budget) : null} />
          <MetaChip icon={Calendar} label="Timeline" value={timeline ? formatWhen(timeline) : intent} />
        </div>

        {requirement ? (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <Tag className="mr-1.5 inline h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            {requirement}
          </p>
        ) : null}

        {lead ? (
          <p className="mt-2 text-xs text-slate-500">
            Source: {OPS_LEAD_SOURCE_LABELS[lead.source]} · Received {formatWhen(lead.createdAt)}
          </p>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <PanelCard title="Call summary">
              <dl className="grid gap-3 sm:grid-cols-2">
                <SummaryItem label="Last called" value={formatWhen(summary.lastCalledAt)} />
                <SummaryItem label="Next follow-up" value={formatWhen(summary.nextFollowUpAt)} />
                <SummaryItem label="Last caller" value={summary.lastCalledByName || '—'} />
                <SummaryItem label="Total attempts" value={String(summary.activityCount)} />
              </dl>
            </PanelCard>

            {prospect ? (
              <PanelCard title="Owner / inventory profile">
                <dl className="grid gap-2 sm:grid-cols-2">
                  <SummaryItem label="Alternate phone" value={formatPhoneDisplay(prospect.alternatePhone)} />
                  <SummaryItem label="Unit" value={prospect.unit} />
                  <SummaryItem label="Source" value={prospect.source.replace(/_/g, ' ')} />
                  <SummaryItem label="Assigned" value={prospect.assignedTo ? 'Assigned' : 'Unassigned'} />
                </dl>
              </PanelCard>
            ) : null}

            {lead ? (
              <PanelCard title="Enquiry context">
                <dl className="grid gap-2 sm:grid-cols-2">
                  <SummaryItem label="Intent" value={lead.intent} />
                  <SummaryItem label="Requirement" value={lead.requirement} />
                  <SummaryItem label="Budget" value={lead.budget != null ? String(lead.budget) : null} />
                  <SummaryItem label="Location" value={lead.location} />
                </dl>
              </PanelCard>
            ) : null}

            {lead && lead.rawSummary && Object.keys(lead.rawSummary).length > 0 ? (
              <PanelCard title="Additional details">
                <dl className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(lead.rawSummary).slice(0, 8).map(([key, value]) => (
                    <SummaryItem
                      key={key}
                      label={key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}
                      value={value == null ? null : String(value)}
                    />
                  ))}
                </dl>
              </PanelCard>
            ) : null}

            {prospect ? (
              <PanelCard title="Notes">
                <Textarea
                  value={currentNotes}
                  onChange={(event) => {
                    setNotes(event.target.value);
                    setNotesDirty(true);
                  }}
                  rows={4}
                  placeholder="Conversation notes, preferences, objections…"
                  className="resize-none border-slate-200 text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  className="mt-2"
                  onClick={saveNotes}
                  disabled={!notesDirty || savingNotes}
                >
                  {savingNotes ? 'Saving…' : 'Save note'}
                </Button>
              </PanelCard>
            ) : null}
          </div>

          <PanelCard title="Activity timeline" className="lg:col-span-1">
            <CallHistoryTimeline activities={activities} variant="workspace" />
          </PanelCard>
        </div>
      </div>
    </section>
  );
}

function MetaChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value?: string | null;
}) {
  if (!value?.trim()) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="truncate text-sm font-semibold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function PanelCard({
  title,
  children,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm ${className}`}>
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">{title}</h3>
      {children}
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-slate-900">{value?.trim() ? value : '—'}</dd>
    </div>
  );
}
