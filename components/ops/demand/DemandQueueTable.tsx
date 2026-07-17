'use client';

import { AlertTriangle } from 'lucide-react';
import DemandPriorityBadge from '@/components/ops/demand/DemandPriorityBadge';
import DemandStatusBadge from '@/components/ops/demand/DemandStatusBadge';
import LeadSourceBadge from '@/components/ops/leads/LeadSourceBadge';
import type { DemandQueueItem } from '@/lib/ops/demand/types';
import { OPS_LEAD_SOURCE_LABELS } from '@/lib/ops/leads/types';
import { formatPhoneDisplay } from '@/lib/ops/phone';

function formatAge(hours: number) {
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function rowTone(item: DemandQueueItem): string {
  const overdue = item.demand.priority === 'HIGH'
    && item.demand.nextFollowUpAt
    && new Date(item.demand.nextFollowUpAt) < new Date();
  if (overdue) return 'bg-red-50/80 border-l-4 border-l-red-500';
  if (item.demand.priority === 'HIGH') return 'bg-orange-50/50 border-l-4 border-l-orange-400';
  if (item.demand.priority === 'MEDIUM') return 'border-l-4 border-l-amber-300';
  return 'border-l-4 border-l-slate-200';
}

type DemandQueueTableProps = {
  items: DemandQueueItem[];
  selectedKey: string | null;
  onSelect: (item: DemandQueueItem) => void;
};

export default function DemandQueueTable({ items, selectedKey, onSelect }: DemandQueueTableProps) {
  if (!items.length) {
    return (
      <div className="px-6 py-10 text-center text-sm text-slate-500">
        No enquiries match your filters.
      </div>
    );
  }

  return (
    <>
    <div className="space-y-2 p-2 md:hidden">
      {items.map((item) => {
        const overdue = item.demand.priority === 'HIGH'
          && item.demand.nextFollowUpAt
          && new Date(item.demand.nextFollowUpAt) < new Date();
        const selected = selectedKey === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item)}
            className={`w-full rounded-lg border border-slate-200 bg-white p-3 text-left ${rowTone(item)} ${
              selected ? 'ring-2 ring-slate-900' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">{item.lead.name || 'Unknown'}</p>
                <p className="text-xs text-slate-500">{formatPhoneDisplay(item.lead.phone)}</p>
              </div>
              <DemandPriorityBadge priority={item.demand.priority} overdue={overdue} />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <LeadSourceBadge source={item.lead.source} />
              <DemandStatusBadge status={item.demand.status} />
            </div>
            <p className="mt-2 text-sm text-slate-600">{item.lead.requirement || item.lead.intent || '—'}</p>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>{formatAge(item.ageHours)} old</span>
              {item.assigneeInitials ? (
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
                  {item.assigneeInitials}
                </span>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
    <div className="hidden md:block">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-2.5 py-2">Priority</th>
              <th className="px-2.5 py-2">Source</th>
              <th className="px-2.5 py-2">Name</th>
              <th className="px-2.5 py-2">Mobile</th>
              <th className="px-2.5 py-2">Requirement</th>
              <th className="px-2.5 py-2">Budget</th>
              <th className="px-2.5 py-2">Project</th>
              <th className="px-2.5 py-2">Location</th>
              <th className="px-2.5 py-2">Assigned</th>
              <th className="px-2.5 py-2">Status</th>
              <th className="px-2.5 py-2">Last Activity</th>
              <th className="px-2.5 py-2">Age</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const overdue = item.demand.priority === 'HIGH'
                && item.demand.nextFollowUpAt
                && new Date(item.demand.nextFollowUpAt) < new Date();
              const selected = selectedKey === item.key;
              return (
                <tr
                  key={item.key}
                  onClick={() => onSelect(item)}
                  className={`cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50 ${rowTone(item)} ${
                    selected ? 'bg-slate-900 text-white hover:bg-slate-800' : ''
                  }`}
                >
                  <td className="px-2.5 py-2">
                    {selected ? (
                      <span className="text-xs font-bold text-orange-300">{item.demand.priority}</span>
                    ) : (
                      <DemandPriorityBadge priority={item.demand.priority} overdue={overdue} />
                    )}
                  </td>
                  <td className="px-2.5 py-2">
                    {selected ? (
                      <span className="text-xs">{OPS_LEAD_SOURCE_LABELS[item.lead.source]}</span>
                    ) : (
                      <LeadSourceBadge source={item.lead.source} />
                    )}
                  </td>
                  <td className="px-2.5 py-2 font-semibold">
                    <div className="flex items-center gap-1.5">
                      {item.lead.name || 'Unknown'}
                      {item.duplicateHints.length ? (
                        <AlertTriangle className={`h-3.5 w-3.5 ${selected ? 'text-amber-300' : 'text-amber-600'}`} title="Possible duplicate" />
                      ) : null}
                    </div>
                  </td>
                  <td className="px-2.5 py-2 font-medium">{formatPhoneDisplay(item.lead.phone)}</td>
                  <td className="max-w-[140px] truncate px-2.5 py-2">{item.lead.requirement || item.lead.intent || '—'}</td>
                  <td className="px-2.5 py-2">{item.demand.qualification.budget || item.lead.budget || '—'}</td>
                  <td className="max-w-[120px] truncate px-2.5 py-2">{item.lead.projectName || '—'}</td>
                  <td className="max-w-[120px] truncate px-2.5 py-2">{item.lead.location || item.demand.qualification.preferredBuildings || '—'}</td>
                  <td className="px-2.5 py-2">
                    {item.assigneeInitials ? (
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                        selected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {item.assigneeInitials}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-2.5 py-2">
                    {!selected ? <DemandStatusBadge status={item.demand.status} /> : (
                      <span className="text-xs">{item.demand.status.replace(/_/g, ' ')}</span>
                    )}
                  </td>
                  <td className="max-w-[140px] truncate px-2.5 py-2 text-xs">
                    {item.lastActivityLabel || '—'}
                  </td>
                  <td className="px-2.5 py-2 text-xs font-medium">{formatAge(item.ageHours)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
    </>
  );
}
