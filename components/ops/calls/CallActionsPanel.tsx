'use client';

import { useState } from 'react';
import { ClipboardList, MessageCircle, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CallResultSheet from '@/components/ops/calls/CallResultSheet';
import CallStatusBadge from '@/components/ops/calls/CallStatusBadge';
import type { CallTargetSummary, OpsCallActivity } from '@/lib/ops/calls/types';
import { isSuperAdmin } from '@/lib/auth/rbac/client';
import { buildTelLink, buildWhatsAppLink, formatPhoneDisplay } from '@/lib/ops/phone';

function formatWhen(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return value;
  }
}

type CallActionsPanelProps = {
  targetType: 'unified_lead' | 'ops_prospect';
  targetSource?: string;
  targetId: string;
  phone?: string | null;
  whatsappMessage?: string;
  callSummary: CallTargetSummary;
  callActivities: OpsCallActivity[];
  currentUser?: { id?: string; role?: string; isSuperAdmin?: boolean } | null;
  onCallContextChange: (payload: {
    summary: CallTargetSummary;
    activities: OpsCallActivity[];
  }) => void;
};

export default function CallActionsPanel({
  targetType,
  targetSource,
  targetId,
  phone,
  whatsappMessage,
  callSummary,
  callActivities,
  currentUser,
  onCallContextChange,
}: CallActionsPanelProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const telLink = buildTelLink(phone);
  const whatsappLink = buildWhatsAppLink(phone, whatsappMessage);
  const callBlocked = callSummary.doNotCall || callSummary.wrongNumber;

  async function refreshCallContext() {
    const params = new URLSearchParams({
      targetType,
      targetId,
    });
    if (targetSource) params.set('targetSource', targetSource);
    const response = await fetch(`/api/ops/calls/activities?${params.toString()}`, {
      credentials: 'include',
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      onCallContextChange({
        summary: data.summary,
        activities: data.activities || [],
      });
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Calling</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <CallStatusBadge status={callSummary.currentStatus} />
            {callSummary.doNotCall ? (
              <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold uppercase text-red-800">
                Do Not Call
              </span>
            ) : null}
            {callSummary.wrongNumber ? (
              <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold uppercase text-rose-800">
                Invalid Number
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <dl className="grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-slate-500">Last called</dt>
          <dd className="text-sm font-medium text-slate-900">{formatWhen(callSummary.lastCalledAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Next follow-up</dt>
          <dd className="text-sm font-medium text-slate-900">{formatWhen(callSummary.nextFollowUpAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Phone</dt>
          <dd className="text-sm font-medium text-slate-900">{formatPhoneDisplay(phone)}</dd>
        </div>
      </dl>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {telLink && !callBlocked ? (
          <Button asChild size="lg" className="h-14 text-base">
            <a href={telLink}>
              <Phone className="mr-2 h-5 w-5" aria-hidden="true" />
              Call
            </a>
          </Button>
        ) : (
          <Button size="lg" className="h-14 text-base" disabled>
            <Phone className="mr-2 h-5 w-5" aria-hidden="true" />
            Call unavailable
          </Button>
        )}

        <Button
          size="lg"
          variant="secondary"
          className="h-14 text-base"
          onClick={() => setSheetOpen(true)}
          disabled={callSummary.doNotCall && !isSuperAdmin(currentUser)}
        >
          <ClipboardList className="mr-2 h-5 w-5" aria-hidden="true" />
          Update Result
        </Button>

        {whatsappLink && !callSummary.doNotCall ? (
          <Button asChild size="lg" variant="outline" className="h-14 text-base">
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-2 h-5 w-5" aria-hidden="true" />
              WhatsApp
            </a>
          </Button>
        ) : (
          <Button size="lg" variant="outline" className="h-14 text-base" disabled>
            WhatsApp unavailable
          </Button>
        )}
      </div>

      <CallResultSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        target={{
          targetType,
          targetSource,
          targetId,
          phone: phone || '',
        }}
        currentSummary={callSummary}
        currentUser={currentUser}
        onSaved={async ({ summary }) => {
          onCallContextChange({
            summary,
            activities: [
              ...callActivities,
            ],
          });
          await refreshCallContext();
        }}
      />
    </section>
  );
}
