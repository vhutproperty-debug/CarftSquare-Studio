'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, MessageCircle, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import DemandActivityTimeline from '@/components/ops/demand/DemandActivityTimeline';
import DemandPriorityBadge from '@/components/ops/demand/DemandPriorityBadge';
import DemandStatusBadge from '@/components/ops/demand/DemandStatusBadge';
import LeadSourceBadge from '@/components/ops/leads/LeadSourceBadge';
import type {
  DemandDuplicateHint,
  DemandQualification,
  DemandQueueItem,
  OpsDemandActivity,
  OpsDemandRecord,
} from '@/lib/ops/demand/types';
import type { NormalizedOpsLead } from '@/lib/ops/leads/types';
import { DEMAND_PRIORITIES, DEMAND_STATUSES } from '@/lib/ops/demand/statuses';
import { DEMAND_PRIORITY_LABELS, DEMAND_STATUS_LABELS } from '@/lib/ops/demand/statuses';
import { buildTelLink, buildWhatsAppLink, formatPhoneDisplay } from '@/lib/ops/phone';
import { OPS_LEAD_SOURCE_LABELS } from '@/lib/ops/leads/types';

type DemandDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: DemandQueueItem | null;
  currentUserId?: string;
  onUpdated: () => void;
};

type DetailState = {
  lead: NormalizedOpsLead;
  demand: OpsDemandRecord;
  activities: OpsDemandActivity[];
  duplicateHints: DemandDuplicateHint[];
  team: Array<{ id: string; name: string; email: string }>;
};

export default function DemandDrawer({
  open,
  onOpenChange,
  item,
  currentUserId,
  onUpdated,
}: DemandDrawerProps) {
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [qualification, setQualification] = useState<DemandQualification>({});
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpTime, setFollowUpTime] = useState('');

  useEffect(() => {
    if (!open || !item) {
      setDetail(null);
      return;
    }

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/ops/demand/${item.lead.source}/${item.lead.sourceId}`, {
          credentials: 'include',
        });
        const data = await res.json();
        if (res.ok) {
          setDetail(data);
          setQualification(data.demand.qualification || {});
          setNotes(data.demand.internalNotes || '');
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [open, item]);

  async function patchDemand(body: Record<string, unknown>) {
    if (!item) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ops/demand/${item.lead.source}/${item.lead.sourceId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setDetail((current) => current ? {
          ...current,
          demand: data.demand,
          activities: data.activities,
        } : current);
        onUpdated();
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveQualification() {
    await patchDemand({ qualification });
  }

  async function saveNotes() {
    await patchDemand({ internalNotes: notes });
  }

  async function scheduleFollowUp() {
    if (!followUpDate || !followUpTime) return;
    const nextFollowUpAt = new Date(`${followUpDate}T${followUpTime}:00`).toISOString();
    await patchDemand({ nextFollowUpAt, status: 'FOLLOW_UP' });
  }

  const telLink = detail ? buildTelLink(detail.lead.phone) : null;
  const whatsappLink = detail ? buildWhatsAppLink(
    detail.lead.phone,
    `Hi ${detail.lead.name || 'there'}, this is CraftSquare regarding your Mumbai property enquiry.`,
  ) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        {loading || !detail ? (
          <p className="py-12 text-center text-sm text-slate-500">Loading enquiry…</p>
        ) : (
          <>
            <SheetHeader className="text-left">
              <div className="flex flex-wrap items-center gap-2 pr-8">
                <LeadSourceBadge source={detail.lead.source} />
                <DemandStatusBadge status={detail.demand.status} />
                <DemandPriorityBadge priority={detail.demand.priority} />
              </div>
              <SheetTitle className="text-2xl">{detail.lead.name || 'Unknown enquiry'}</SheetTitle>
              <SheetDescription>
                {OPS_LEAD_SOURCE_LABELS[detail.lead.source]} · {formatPhoneDisplay(detail.lead.phone)}
              </SheetDescription>
            </SheetHeader>

            {detail.duplicateHints.length ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <AlertTriangle className="mr-1 inline h-4 w-4" />
                Possible duplicate ({detail.duplicateHints.length}) — same mobile or email on another enquiry. Not merged.
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {telLink ? (
                <Button asChild size="lg" className="h-12">
                  <a href={telLink}><Phone className="mr-2 h-4 w-4" />Call</a>
                </Button>
              ) : null}
              {whatsappLink ? (
                <Button asChild size="lg" variant="outline" className="h-12">
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" />WhatsApp
                  </a>
                </Button>
              ) : null}
            </div>

            <section className="mt-6 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Status & assignment</h3>
              <div className="grid gap-2 sm:grid-cols-3">
                <select
                  className="h-10 rounded-md border border-slate-200 px-3 text-sm"
                  value={detail.demand.status}
                  onChange={(e) => patchDemand({ status: e.target.value })}
                  disabled={saving}
                >
                  {DEMAND_STATUSES.map((s) => (
                    <option key={s} value={s}>{DEMAND_STATUS_LABELS[s]}</option>
                  ))}
                </select>
                <select
                  className="h-10 rounded-md border border-slate-200 px-3 text-sm"
                  value={detail.demand.priority}
                  onChange={(e) => patchDemand({ priority: e.target.value })}
                  disabled={saving}
                >
                  {DEMAND_PRIORITIES.map((p) => (
                    <option key={p} value={p}>{DEMAND_PRIORITY_LABELS[p]}</option>
                  ))}
                </select>
                <select
                  className="h-10 rounded-md border border-slate-200 px-3 text-sm"
                  value={detail.demand.assignedTo || ''}
                  onChange={(e) => patchDemand({ assignedTo: e.target.value })}
                  disabled={saving}
                >
                  <option value="">Unassigned</option>
                  {currentUserId ? (
                    <option value={currentUserId}>Assign to me</option>
                  ) : null}
                  {detail.team.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </section>

            <section className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Qualification ({detail.demand.qualificationPercent}%)
                </h3>
                <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${detail.demand.qualificationPercent}%` }}
                  />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <QualField label="Rent / Buy" value={qualification.rentBuy || ''} onChange={(v) => setQualification((q) => ({ ...q, rentBuy: v as DemandQualification['rentBuy'] }))} options={['rent', 'buy', 'unknown']} />
                <QualInput label="Budget" value={qualification.budget || ''} onChange={(v) => setQualification((q) => ({ ...q, budget: v }))} />
                <QualInput label="BHK" value={qualification.bhk || ''} onChange={(v) => setQualification((q) => ({ ...q, bhk: v }))} />
                <QualInput label="Furnishing" value={qualification.furnishing || ''} onChange={(v) => setQualification((q) => ({ ...q, furnishing: v }))} />
                <QualInput label="Preferred buildings" value={qualification.preferredBuildings || ''} onChange={(v) => setQualification((q) => ({ ...q, preferredBuildings: v }))} className="sm:col-span-2" />
                <QualInput label="Possession timeline" value={qualification.possessionTimeline || ''} onChange={(v) => setQualification((q) => ({ ...q, possessionTimeline: v }))} />
                <QualInput label="Family / Bachelor" value={qualification.familyOrBachelor || ''} onChange={(v) => setQualification((q) => ({ ...q, familyOrBachelor: v }))} />
                <QualInput label="Company" value={qualification.company || ''} onChange={(v) => setQualification((q) => ({ ...q, company: v }))} />
                <QualInput label="Parking" value={qualification.parkingRequirement || ''} onChange={(v) => setQualification((q) => ({ ...q, parkingRequirement: v }))} />
                <QualInput label="Pets" value={qualification.pets || ''} onChange={(v) => setQualification((q) => ({ ...q, pets: v }))} />
              </div>
              <Textarea
                rows={2}
                placeholder="Qualification notes"
                value={qualification.notes || ''}
                onChange={(e) => setQualification((q) => ({ ...q, notes: e.target.value }))}
              />
              <Button type="button" size="sm" onClick={saveQualification} disabled={saving}>Save qualification</Button>
            </section>

            <section className="mt-6 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Internal notes</h3>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              <Button type="button" size="sm" variant="outline" onClick={saveNotes} disabled={saving}>Add note</Button>
            </section>

            <section className="mt-6 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Follow-up</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
                <Input type="time" value={followUpTime} onChange={(e) => setFollowUpTime(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={scheduleFollowUp} disabled={saving}>Schedule</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => patchDemand({ followUpCompleted: true })} disabled={saving}>
                  Mark completed
                </Button>
              </div>
            </section>

            <section className="mt-6">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Activity timeline</h3>
              <DemandActivityTimeline activities={detail.activities} />
            </section>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function QualInput({
  label,
  value,
  onChange,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <label className={`block text-xs ${className}`}>
      <span className="font-medium text-slate-600">{label}</span>
      <Input className="mt-1 h-9" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function QualField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="block text-xs">
      <span className="font-medium text-slate-600">{label}</span>
      <select
        className="mt-1 h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}
