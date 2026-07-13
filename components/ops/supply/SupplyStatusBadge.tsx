'use client';

import type { SupplyStatus } from '@/lib/ops/supply/statuses';
import { SUPPLY_STATUS_LABELS } from '@/lib/ops/supply/statuses';

const TONES: Partial<Record<SupplyStatus, string>> = {
  NEW: 'bg-blue-100 text-blue-800',
  VERIFIED: 'bg-indigo-100 text-indigo-800',
  OWNER_CONTACTED: 'bg-violet-100 text-violet-800',
  AVAILABLE: 'bg-emerald-100 text-emerald-800',
  RESERVED: 'bg-amber-100 text-amber-900',
  MATCHED: 'bg-cyan-100 text-cyan-900',
  DEAL_IN_PROGRESS: 'bg-orange-100 text-orange-900',
  CLOSED: 'bg-slate-200 text-slate-700',
  WITHDRAWN: 'bg-rose-100 text-rose-800',
  EXPIRED: 'bg-red-100 text-red-800',
};

export default function SupplyStatusBadge({ status }: { status: SupplyStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TONES[status] || 'bg-slate-100 text-slate-700'}`}>
      {SUPPLY_STATUS_LABELS[status]}
    </span>
  );
}
