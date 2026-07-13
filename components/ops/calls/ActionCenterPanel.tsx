'use client';

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import {
  Bell,
  CalendarClock,
  ClipboardList,
  Mail,
  MessageCircle,
  Phone,
  PhoneOff,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import CallResultSheet from '@/components/ops/calls/CallResultSheet';
import type { CallTargetSummary, OpsCallActivity } from '@/lib/ops/calls/types';
import type { CallActivityStatus } from '@/lib/ops/calls/statuses';
import { isSuperAdmin } from '@/lib/auth/rbac/client';
import { buildTelLink, buildWhatsAppLink } from '@/lib/ops/phone';
import type { WorkspaceDetail } from '@/components/ops/calls/LeadWorkspacePanel';

type ActionCenterPanelProps = {
  detail: WorkspaceDetail | null;
  currentUser?: { id?: string; role?: string; isSuperAdmin?: boolean } | null;
  onCallContextChange: (payload: {
    summary: CallTargetSummary;
    activities: OpsCallActivity[];
  }) => void;
  onQueueRefresh: () => void;
  onConvertToProspect?: () => void;
  callLinkRef?: React.RefObject<HTMLAnchorElement | null>;
  onSheetOpenChange?: (open: boolean) => void;
};

export type ActionCenterHandle = {
  openFollowUp: () => void;
  openStatus: () => void;
};

const ActionCenterPanel = forwardRef<ActionCenterHandle, ActionCenterPanelProps>(function ActionCenterPanel(
  {
    detail,
    currentUser,
    onCallContextChange,
    onQueueRefresh,
    onConvertToProspect,
    callLinkRef,
    onSheetOpenChange,
  },
  ref,
) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [presetStatus, setPresetStatus] = useState<CallActivityStatus | null>(null);
  const internalCallRef = useRef<HTMLAnchorElement>(null);
  const telRef = callLinkRef || internalCallRef;

  function openSheet(status: CallActivityStatus | null = null) {
    setPresetStatus(status);
    setSheetOpen(true);
    onSheetOpenChange?.(true);
  }

  useImperativeHandle(ref, () => ({
    openFollowUp: () => openSheet('FOLLOW_UP'),
    openStatus: () => openSheet(null),
  }));

  if (!detail) {
    return (
      <aside className="flex h-full min-h-0 flex-col border-l border-slate-200/80 bg-white">
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <p className="text-sm text-slate-500">Actions appear when a lead is selected.</p>
        </div>
      </aside>
    );
  }

  const summary = detail.summary;
  const activities = detail.activities;
  const phone = detail.kind === 'ops_prospect' ? detail.prospect.phone : detail.lead.phone || '';
  const name = detail.kind === 'ops_prospect' ? detail.prospect.name : detail.lead.name;
  const targetType = detail.kind;
  const targetId = detail.kind === 'ops_prospect' ? detail.prospect.id : detail.lead.sourceId;
  const targetSource = detail.kind === 'unified_lead' ? detail.lead.source : undefined;
  const whatsappMessage = detail.kind === 'unified_lead'
    ? `Hi, this is CraftSquare Studio regarding your enquiry, ${name || 'there'}.`
    : `Hi ${name || 'there'}, this is CraftSquare Studio.`;

  const telLink = buildTelLink(phone);
  const whatsappLink = buildWhatsAppLink(phone, whatsappMessage);
  const smsLink = telLink ? `sms:+91${phone.replace(/\D/g, '').slice(-10)}` : null;
  const email = detail.kind === 'ops_prospect' ? detail.prospect.email : detail.lead.email;
  const mailtoLink = email ? `mailto:${email}?subject=${encodeURIComponent('CraftSquare Studio')}` : null;
  const callBlocked = summary.doNotCall || summary.wrongNumber;
  const canOverrideDnc = summary.doNotCall && isSuperAdmin(currentUser);

  async function refreshCallContext() {
    const params = new URLSearchParams({ targetType, targetId });
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
      onQueueRefresh();
    }
  }

  function triggerCall() {
    telRef.current?.click();
  }

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-slate-200/80 bg-white">
      <div className="shrink-0 border-b border-slate-100 px-4 py-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Outreach Actions</h2>
        <p className="mt-1 text-sm text-slate-600">Advance demand follow-up or build supply inventory.</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {telLink && !callBlocked ? (
            <>
              <Button
                type="button"
                size="lg"
                className="h-16 w-full text-lg font-bold shadow-md"
                onClick={triggerCall}
              >
                <Phone className="mr-2 h-6 w-6" aria-hidden="true" />
                CALL
                <kbd className="ml-auto rounded bg-white/20 px-2 py-0.5 text-xs font-medium">C</kbd>
              </Button>
              <a ref={telRef} href={telLink} className="sr-only" tabIndex={-1} aria-hidden="true">
                Call
              </a>
            </>
          ) : (
            <Button size="lg" className="h-16 w-full text-lg font-bold" disabled>
              <Phone className="mr-2 h-6 w-6" aria-hidden="true" />
              Call unavailable
            </Button>
          )}

          <div className="grid grid-cols-2 gap-2">
            {whatsappLink && !summary.doNotCall ? (
              <Button asChild variant="outline" className="h-12 gap-1.5 text-sm font-semibold">
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  WhatsApp
                </a>
              </Button>
            ) : (
              <Button variant="outline" className="h-12 text-sm" disabled>WhatsApp</Button>
            )}

            {smsLink && !summary.doNotCall ? (
              <Button asChild variant="outline" className="h-12 gap-1.5 text-sm font-semibold">
                <a href={smsLink}>
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  SMS
                </a>
              </Button>
            ) : (
              <Button variant="outline" className="h-12 text-sm" disabled>SMS</Button>
            )}

            {mailtoLink ? (
              <Button asChild variant="outline" className="h-12 gap-1.5 text-sm font-semibold col-span-2">
                <a href={mailtoLink}>
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  Email
                </a>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="my-4 border-t border-slate-100" />

        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Quick outcomes</p>
        <div className="space-y-2">
          <ActionButton
            icon={ThumbsUp}
            label="Mark Interested"
            shortcut=""
            onClick={() => openSheet('INTERESTED')}
            disabled={summary.doNotCall && !canOverrideDnc}
            variant="success"
          />
          <ActionButton
            icon={ThumbsDown}
            label="Not Interested"
            onClick={() => openSheet('NOT_INTERESTED')}
            disabled={summary.doNotCall && !canOverrideDnc}
          />
          <ActionButton
            icon={PhoneOff}
            label="No Answer"
            onClick={() => openSheet('NO_ANSWER')}
            disabled={summary.doNotCall && !canOverrideDnc}
          />
          <ActionButton
            icon={CalendarClock}
            label="Schedule Callback"
            onClick={() => openSheet('CALL_BACK')}
            disabled={summary.doNotCall && !canOverrideDnc}
          />
          <ActionButton
            icon={Bell}
            label="Schedule Follow-up"
            shortcut="F"
            onClick={() => openSheet('FOLLOW_UP')}
            disabled={summary.doNotCall && !canOverrideDnc}
          />
          <ActionButton
            icon={ClipboardList}
            label="Update Status"
            shortcut="S"
            onClick={() => openSheet(null)}
            disabled={summary.doNotCall && !canOverrideDnc}
          />
          {detail.kind === 'unified_lead' && onConvertToProspect ? (
            <ActionButton
              icon={UserPlus}
              label="Add to Supply Pipeline"
              onClick={onConvertToProspect}
              variant="accent"
            />
          ) : null}
        </div>

        {summary.doNotCall && !canOverrideDnc ? (
          <p className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-800">
            Do Not Call — contact an owner to override.
          </p>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-slate-100 bg-slate-50/50 px-4 py-3">
        <p className="text-[10px] font-medium text-slate-400">
          <Sparkles className="mr-1 inline h-3 w-3" aria-hidden="true" />
          Shortcuts: N next · C call · F follow-up · S status
        </p>
      </div>

      <CallResultSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!open) setPresetStatus(null);
          setSheetOpen(open);
          onSheetOpenChange?.(open);
        }}
        target={{
          targetType,
          targetSource,
          targetId,
          phone: phone || '',
        }}
        currentSummary={summary}
        currentUser={currentUser}
        initialStatus={presetStatus}
        onSaved={async ({ summary: nextSummary }) => {
          onCallContextChange({ summary: nextSummary, activities });
          await refreshCallContext();
        }}
      />
    </aside>
  );
});

export default ActionCenterPanel;

function ActionButton({
  icon: Icon,
  label,
  shortcut,
  onClick,
  disabled,
  variant = 'default',
}: {
  icon: typeof Phone;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'success' | 'accent';
}) {
  const styles = {
    default: 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800',
    success: 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-900',
    accent: 'border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-900',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm font-semibold transition-colors disabled:opacity-50 ${styles[variant]}`}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
      <span className="flex-1">{label}</span>
      {shortcut ? (
        <kbd className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-500">
          {shortcut}
        </kbd>
      ) : null}
    </button>
  );
}
