'use client';

import { Search, ChevronRight, Plus, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import CallStatusBadge from '@/components/ops/calls/CallStatusBadge';
import BusinessTypeBadge from '@/components/ops/BusinessTypeBadge';
import type { CallQueueItem } from '@/lib/ops/calls/types';
import { getRecordBusinessType } from '@/lib/ops/business';
import { formatPhoneDisplay } from '@/lib/ops/phone';

export type QueueSectionId =
  | 'follow_ups_due'
  | 'overdue'
  | 'callbacks'
  | 'interested'
  | 'not_called'
  | 'recently_called';

export const QUEUE_SECTIONS: Array<{
  id: QueueSectionId;
  label: string;
  apiSection: string;
  callStatus?: string;
  priorityClass: string;
}> = [
  { id: 'follow_ups_due', label: 'Today', apiSection: 'follow_ups_due', priorityClass: 'border-l-blue-500' },
  { id: 'overdue', label: 'Overdue', apiSection: 'overdue', priorityClass: 'border-l-red-500' },
  { id: 'callbacks', label: 'Callbacks', apiSection: 'all', callStatus: 'CALL_BACK', priorityClass: 'border-l-violet-500' },
  { id: 'interested', label: 'Interested', apiSection: 'interested', priorityClass: 'border-l-emerald-500' },
  { id: 'not_called', label: 'New', apiSection: 'not_called', priorityClass: 'border-l-amber-500' },
  { id: 'recently_called', label: 'Completed Today', apiSection: 'recently_called', priorityClass: 'border-l-slate-400' },
];

function formatWhen(value?: string | null) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return value;
  }
}

function priorityBorder(item: CallQueueItem): string {
  if (item.doNotCall) return 'border-l-red-600';
  if (item.nextFollowUpAt && new Date(item.nextFollowUpAt) < new Date()) return 'border-l-red-500';
  if (item.callStatus === 'INTERESTED') return 'border-l-emerald-500';
  if (item.callStatus === 'NOT_CALLED') return 'border-l-amber-500';
  if (item.callStatus === 'CALL_BACK' || item.callStatus === 'FOLLOW_UP') return 'border-l-violet-500';
  return 'border-l-slate-300';
}

type QueuePanelProps = {
  section: QueueSectionId;
  onSectionChange: (section: QueueSectionId) => void;
  sections: Array<{ id: string; label: string; count: number }>;
  items: CallQueueItem[];
  selectedId: string | null;
  onSelect: (item: CallQueueItem) => void;
  search: string;
  onSearchChange: (value: string) => void;
  mineOnly: boolean;
  onMineOnlyChange: (value: boolean) => void;
  loading: boolean;
  onNextLead: () => void;
  onAddProspect: () => void;
};

export default function QueuePanel({
  section,
  onSectionChange,
  sections,
  items,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  mineOnly,
  onMineOnlyChange,
  loading,
  onNextLead,
  onAddProspect,
}: QueuePanelProps) {
  const sectionCounts = new Map(sections.map((s) => [s.id, s.count]));

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-slate-200/80 bg-white">
      <div className="shrink-0 space-y-3 border-b border-slate-100 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">Outreach Queue</h2>
          <Button type="button" size="sm" variant="outline" onClick={onAddProspect} className="h-8 gap-1 text-xs">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add
          </Button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search owner, phone, project…"
            className="h-9 border-slate-200 bg-slate-50 pl-9 text-sm"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(event) => onMineOnlyChange(event.target.checked)}
            className="rounded border-slate-300"
          />
          <UserCheck className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          Assigned to me only
        </label>
      </div>

      <nav className="shrink-0 border-b border-slate-100 px-2 py-2" aria-label="Queue sections">
        <div className="flex flex-wrap gap-1">
          {QUEUE_SECTIONS.map((tab) => {
            const count = tab.id === 'callbacks'
              ? (section === 'callbacks' ? items.length : sectionCounts.get('follow_ups_due'))
              : sectionCounts.get(tab.id);
            const active = section === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSectionChange(tab.id)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
                {count != null ? ` ${count}` : ''}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="shrink-0 border-b border-slate-100 px-4 py-2">
        <Button
          type="button"
          onClick={onNextLead}
          disabled={!items.length}
          className="h-10 w-full gap-2 text-sm font-semibold"
        >
          Next Lead
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
          <kbd className="ml-auto hidden rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-medium lg:inline">N</kbd>
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Loading queue…</p>
        ) : !items.length ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">No records in this outreach queue.</p>
        ) : (
          <ul className="divide-y divide-slate-100 p-2">
            {items.map((item) => {
              const businessType = getRecordBusinessType(item.kind);
              return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item)}
                  className={`w-full rounded-lg border-l-4 px-3 py-3 text-left transition-all ${
                    priorityBorder(item)
                  } ${
                    selectedId === item.id
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="mb-1.5">
                    {selectedId === item.id ? (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-orange-300">
                        {businessType.label}
                      </span>
                    ) : (
                      <BusinessTypeBadge pillar={businessType.pillar} label={businessType.label} size="sm" />
                    )}
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <p className={`truncate text-base font-bold leading-tight ${
                      selectedId === item.id ? 'text-white' : 'text-slate-900'
                    }`}>
                      {item.name || 'Unknown'}
                    </p>
                    {selectedId !== item.id ? (
                      <CallStatusBadge status={item.callStatus} />
                    ) : null}
                  </div>
                  <p className={`mt-1 text-sm font-semibold ${
                    selectedId === item.id ? 'text-slate-200' : 'text-slate-700'
                  }`}>
                    {formatPhoneDisplay(item.phone)}
                  </p>
                  {(item.projectName || item.building) ? (
                    <p className={`mt-1 truncate text-xs ${
                      selectedId === item.id ? 'text-slate-300' : 'text-slate-500'
                    }`}>
                      {[item.projectName, item.building].filter(Boolean).join(' · ')}
                    </p>
                  ) : null}
                  <div className={`mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] ${
                    selectedId === item.id ? 'text-slate-400' : 'text-slate-400'
                  }`}>
                    {item.lastCalledAt ? <span>Last: {formatWhen(item.lastCalledAt)}</span> : null}
                    {item.nextFollowUpAt ? (
                      <span className={selectedId === item.id ? 'text-amber-300' : 'font-medium text-violet-600'}>
                        F/U: {formatWhen(item.nextFollowUpAt)}
                      </span>
                    ) : null}
                    {item.assignedToName ? <span>{item.assignedToName}</span> : null}
                  </div>
                  {item.doNotCall ? (
                    <span className="mt-1 inline-block text-[10px] font-bold uppercase text-red-500">DNC</span>
                  ) : null}
                </button>
              </li>
            );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
