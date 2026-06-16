'use client';

import { Check } from 'lucide-react';
import {
  LEAD_PIPELINE,
  formatLeadStageLabel,
  getLeadStageIndex,
  getLeadStageState,
} from '@/lib/partner-network/pipeline';

const STAGE_STYLES = {
  completed: 'border-emerald-500 bg-emerald-50 text-emerald-800',
  active: 'border-orange-500 bg-orange-600 text-white ring-2 ring-orange-200',
  inactive: 'border-slate-200 bg-slate-50 text-slate-400',
};

export default function LeadPipelineTracker({ status, compact = false }) {
  const currentIndex = getLeadStageIndex(status);

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex flex-wrap items-center gap-1">
        {LEAD_PIPELINE.map((stage, index) => {
          const state = getLeadStageState(index, currentIndex);
          const label = formatLeadStageLabel(stage);
          return (
            <div key={stage} className="flex items-center gap-1">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${STAGE_STYLES[state]}`}
                title={label}
              >
                {state === 'completed' && <Check className="h-3 w-3 shrink-0" aria-hidden="true" />}
                {label}
              </span>
              {index < LEAD_PIPELINE.length - 1 && (
                <span className={`text-xs ${index < currentIndex ? 'text-emerald-400' : 'text-slate-300'}`} aria-hidden="true">
                  →
                </span>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-500">
        Current stage: <span className="font-semibold capitalize text-orange-700">{formatLeadStageLabel(status)}</span>
      </p>
    </div>
  );
}

export function formatLeadActivityLabel(entry) {
  if (entry.action === 'lead_status_changed') {
    const leadId = entry.details?.leadId || 'Lead';
    const from = formatLeadStageLabel(String(entry.details?.previousStatus || ''));
    const to = formatLeadStageLabel(String(entry.details?.status || ''));
    return `${leadId}: ${from} → ${to}`;
  }
  if (entry.action === 'lead_submitted') {
    return `Lead ${entry.details?.leadId || ''} submitted`;
  }
  return entry.action.replace(/_/g, ' ');
}
