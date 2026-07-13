'use client';

import { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, Star, XCircle } from 'lucide-react';
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
import MatchScoreBadge from '@/components/ops/matching/MatchScoreBadge';
import MatchTimeline from '@/components/ops/matching/MatchTimeline';
import type { MatchDemandSummary, OpsMatchActivity, OpsMatchRecord, OpsSupplyRecord } from '@/lib/ops/matching/types';
import { MATCH_STATUSES, MATCH_STATUS_LABELS } from '@/lib/ops/matching/statuses';
import { formatPhoneDisplay } from '@/lib/ops/phone';
import { supplyDisplayLabel } from '@/lib/ops/supply/types';

type MatchingDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchId: string | null;
  currentUserId?: string;
  onUpdated: () => void;
};

type DetailState = {
  match: OpsMatchRecord;
  demand: MatchDemandSummary;
  supply: OpsSupplyRecord;
  activities: OpsMatchActivity[];
  team: Array<{ id: string; name: string; email: string }>;
};

export default function MatchingDrawer({
  open,
  onOpenChange,
  matchId,
  currentUserId,
  onUpdated,
}: MatchingDrawerProps) {
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [siteVisitDate, setSiteVisitDate] = useState('');
  const [siteVisitTime, setSiteVisitTime] = useState('');
  const [creatingDeal, setCreatingDeal] = useState(false);
  const [dealMessage, setDealMessage] = useState('');

  useEffect(() => {
    if (!open || !matchId) {
      setDetail(null);
      return;
    }

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/ops/matching/${matchId}`, { credentials: 'include' });
        const data = await res.json();
        if (res.ok) {
          setDetail({ match: data.match, demand: data.demand, supply: data.supply, activities: data.activities, team: data.team });
          setNotes(data.match.notes || '');
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [open, matchId]);

  async function createDeal() {
    if (!matchId) return;
    setCreatingDeal(true);
    setDealMessage('');
    try {
      const res = await fetch('/api/ops/deals/queue', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId }),
      });
      const data = await res.json();
      if (res.ok) {
        setDealMessage(data.alreadyExists
          ? `Deal ${data.deal.dealNumber} already exists.`
          : `Deal ${data.deal.dealNumber} created.`);
        onUpdated();
        if (detail) {
          setDetail({
            ...detail,
            match: { ...detail.match, status: 'CONVERTED_TO_DEAL' },
          });
        }
      } else {
        setDealMessage(data.error || 'Unable to create deal.');
      }
    } finally {
      setCreatingDeal(false);
    }
  }

  const canCreateDeal = detail?.match.status === 'ACCEPTED' || detail?.match.status === 'CONVERTED_TO_DEAL';

  async function patchMatch(body: Record<string, unknown>) {
    if (!matchId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ops/matching/${matchId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setDetail((current) => current ? {
          ...current,
          match: data.match,
          activities: data.activities,
        } : current);
        onUpdated();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        {loading || !detail ? (
          <p className="py-12 text-center text-sm text-slate-500">Loading match…</p>
        ) : (
          <>
            <SheetHeader className="text-left">
              <div className="flex flex-wrap items-center gap-2 pr-8">
                <MatchScoreBadge score={detail.match.score} />
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                  {MATCH_STATUS_LABELS[detail.match.status]}
                </span>
              </div>
              <SheetTitle className="text-2xl">Match review</SheetTitle>
              <SheetDescription>
                {detail.demand.name || 'Demand'} → {supplyDisplayLabel(detail.supply)}
              </SheetDescription>
            </SheetHeader>

            <section className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" disabled={saving} onClick={() => patchMatch({ status: 'SHORTLISTED' })}>
                <Star className="mr-1.5 h-4 w-4" />Shortlist
              </Button>
              <Button size="sm" variant="outline" disabled={saving} onClick={() => patchMatch({ status: 'REJECTED' })}>
                <XCircle className="mr-1.5 h-4 w-4" />Reject
              </Button>
              <Button size="sm" variant="outline" disabled={saving} onClick={() => patchMatch({ status: 'ACCEPTED' })}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" />Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={saving || creatingDeal || !canCreateDeal}
                onClick={createDeal}
              >
                Create Deal
              </Button>
            </section>

            {dealMessage ? (
              <p className="mt-2 text-sm text-emerald-800">{dealMessage}</p>
            ) : null}

            <section className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-700">Demand</h3>
                <p className="mt-2 font-semibold text-slate-900">{detail.demand.name || 'Unknown'}</p>
                <p className="text-sm text-slate-600">{formatPhoneDisplay(detail.demand.phone)}</p>
                <dl className="mt-3 space-y-1 text-xs text-slate-600">
                  <div><dt className="inline font-medium">Project: </dt><dd className="inline">{detail.demand.projectName || '—'}</dd></div>
                  <div><dt className="inline font-medium">Budget: </dt><dd className="inline">{detail.demand.budget || '—'}</dd></div>
                  <div><dt className="inline font-medium">BHK: </dt><dd className="inline">{detail.demand.qualification.bhk || '—'}</dd></div>
                  <div><dt className="inline font-medium">Rent/Buy: </dt><dd className="inline">{detail.demand.qualification.rentBuy || '—'}</dd></div>
                </dl>
              </div>
              <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-violet-700">Supply</h3>
                <p className="mt-2 font-semibold text-slate-900">{supplyDisplayLabel(detail.supply)}</p>
                <p className="text-sm text-slate-600">{detail.supply.ownerName || 'Owner TBD'}</p>
                <dl className="mt-3 space-y-1 text-xs text-slate-600">
                  <div><dt className="inline font-medium">Project: </dt><dd className="inline">{detail.supply.project || '—'}</dd></div>
                  <div><dt className="inline font-medium">Rent/Price: </dt><dd className="inline">{detail.supply.expectedRent || detail.supply.expectedSalePrice || '—'}</dd></div>
                  <div><dt className="inline font-medium">Config: </dt><dd className="inline">{detail.supply.configuration || '—'}</dd></div>
                  <div><dt className="inline font-medium">Furnishing: </dt><dd className="inline">{detail.supply.furnishedStatus || '—'}</dd></div>
                </dl>
              </div>
            </section>

            <section className="mt-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Match reasons</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {detail.match.reasons.map((reason) => (
                  <li key={reason} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                    {reason}
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-6 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Assignment & status</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  className="h-10 rounded-md border border-slate-200 px-3 text-sm"
                  value={detail.match.status}
                  onChange={(e) => patchMatch({ status: e.target.value })}
                  disabled={saving}
                >
                  {MATCH_STATUSES.map((s) => (
                    <option key={s} value={s}>{MATCH_STATUS_LABELS[s]}</option>
                  ))}
                </select>
                <select
                  className="h-10 rounded-md border border-slate-200 px-3 text-sm"
                  value={detail.match.broker || ''}
                  onChange={(e) => patchMatch({ broker: e.target.value })}
                  disabled={saving}
                >
                  <option value="">Unassigned</option>
                  {currentUserId ? <option value={currentUserId}>Assign to me</option> : null}
                  {detail.team.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </section>

            <section className="mt-6 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Broker notes</h3>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              <Button type="button" size="sm" variant="outline" onClick={() => patchMatch({ notes })} disabled={saving}>
                Save notes
              </Button>
            </section>

            <section className="mt-6 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Site visit</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input type="date" value={siteVisitDate} onChange={(e) => setSiteVisitDate(e.target.value)} />
                <Input type="time" value={siteVisitTime} onChange={(e) => setSiteVisitTime(e.target.value)} />
              </div>
              <Button
                type="button"
                size="sm"
                disabled={saving || !siteVisitDate || !siteVisitTime}
                onClick={() => {
                  const siteVisitAt = new Date(`${siteVisitDate}T${siteVisitTime}:00`).toISOString();
                  patchMatch({ siteVisitAt, status: 'SITE_VISIT_SCHEDULED' });
                }}
              >
                <Calendar className="mr-1.5 h-4 w-4" />Schedule site visit
              </Button>
            </section>

            <section className="mt-6">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Timeline</h3>
              <MatchTimeline activities={detail.activities} />
            </section>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
