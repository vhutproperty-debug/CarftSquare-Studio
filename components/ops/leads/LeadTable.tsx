'use client';

import Link from 'next/link';
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

function leadHref(lead: NormalizedOpsLead) {
  return `/ops/leads/${lead.source}/${lead.sourceId}`;
}

function summaryLine(lead: NormalizedOpsLead) {
  return lead.projectName || lead.intent || lead.requirement || '—';
}

type LeadTableProps = {
  leads: NormalizedOpsLead[];
};

export default function LeadTable({ leads }: LeadTableProps) {
  if (!leads.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
        No leads match the current filters.
      </div>
    );
  }

  return (
    <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">Category / Intent</th>
            <th className="px-4 py-3">Project / Requirement</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Received</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {leads.map((lead) => (
            <tr key={`${lead.source}:${lead.sourceId}`} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <Link href={leadHref(lead)} className="block font-semibold text-slate-900 hover:text-orange-600">
                  {lead.name || 'Unknown'}
                </Link>
                <p className="mt-0.5 text-slate-500">{formatPhoneDisplay(lead.phone)}</p>
              </td>
              <td className="px-4 py-3">
                <LeadSourceBadge source={lead.source} />
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col gap-1">
                  <LeadCategoryBadge category={lead.category} />
                  {lead.intent ? <span className="text-slate-600">{lead.intent}</span> : null}
                </div>
              </td>
              <td className="px-4 py-3 text-slate-700">{summaryLine(lead)}</td>
              <td className="px-4 py-3">
                <LeadStatusBadge status={lead.sourceStatus} />
              </td>
              <td className="px-4 py-3 text-slate-600">{formatReceivedAt(lead.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
