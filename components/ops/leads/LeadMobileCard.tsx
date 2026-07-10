'use client';

import Link from 'next/link';
import { ChevronRight, Phone } from 'lucide-react';
import type { NormalizedOpsLead } from '@/lib/ops/leads/types';
import { formatPhoneDisplay } from '@/lib/ops/phone';
import LeadSourceBadge, { LeadCategoryBadge } from '@/components/ops/leads/LeadSourceBadge';
import LeadStatusBadge from '@/components/ops/leads/LeadStatusBadge';

function formatReceivedAt(value: string) {
  try {
    return new Date(value).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return value;
  }
}

type LeadMobileCardProps = {
  lead: NormalizedOpsLead;
};

export default function LeadMobileCard({ lead }: LeadMobileCardProps) {
  const href = `/ops/leads/${lead.source}/${lead.sourceId}`;

  return (
    <Link
      href={href}
      className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-slate-900">{lead.name || 'Unknown'}</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <Phone className="h-4 w-4 shrink-0 text-orange-600" aria-hidden="true" />
            {formatPhoneDisplay(lead.phone)}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <LeadSourceBadge source={lead.source} />
        <LeadCategoryBadge category={lead.category} />
        <LeadStatusBadge status={lead.sourceStatus} />
      </div>

      <p className="mt-3 line-clamp-2 text-sm text-slate-600">
        {lead.projectName || lead.intent || lead.requirement || 'No requirement captured'}
      </p>

      <p className="mt-3 text-xs font-medium text-slate-500">{formatReceivedAt(lead.createdAt)}</p>
    </Link>
  );
}

type LeadMobileListProps = {
  leads: NormalizedOpsLead[];
};

export function LeadMobileList({ leads }: LeadMobileListProps) {
  if (!leads.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500 md:hidden">
        No leads match the current filters.
      </div>
    );
  }

  return (
    <div className="space-y-3 md:hidden">
      {leads.map((lead) => (
        <LeadMobileCard key={`${lead.source}:${lead.sourceId}`} lead={lead} />
      ))}
    </div>
  );
}
