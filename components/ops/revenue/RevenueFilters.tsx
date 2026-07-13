'use client';

import { Input } from '@/components/ui/input';
import { REVENUE_STATUSES, REVENUE_STATUS_LABELS, REVENUE_STREAM_TYPES, REVENUE_STREAM_LABELS } from '@/lib/ops/revenue/statuses';

export type RevenueFilterState = {
  search: string;
  status: string;
  streamType: string;
  broker: string;
  overdueOnly: boolean;
  mineOnly: boolean;
};

type RevenueFiltersProps = {
  filters: RevenueFilterState;
  onChange: (filters: RevenueFilterState) => void;
  team: Array<{ id: string; name: string; email: string }>;
};

export default function RevenueFilters({ filters, onChange, team }: RevenueFiltersProps) {
  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-6">
      <Input
        placeholder="Search deal, client, project…"
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
        className="xl:col-span-2"
      />
      <select
        className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        value={filters.status}
        onChange={(e) => onChange({ ...filters, status: e.target.value })}
      >
        <option value="all">All statuses</option>
        {REVENUE_STATUSES.map((s) => (
          <option key={s} value={s}>{REVENUE_STATUS_LABELS[s]}</option>
        ))}
      </select>
      <select
        className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        value={filters.streamType}
        onChange={(e) => onChange({ ...filters, streamType: e.target.value })}
      >
        <option value="all">All streams</option>
        {REVENUE_STREAM_TYPES.map((s) => (
          <option key={s} value={s}>{REVENUE_STREAM_LABELS[s]}</option>
        ))}
      </select>
      <select
        className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        value={filters.broker}
        onChange={(e) => onChange({ ...filters, broker: e.target.value })}
      >
        <option value="all">All brokers</option>
        {team.map((m) => (
          <option key={m.id} value={m.id}>{m.name || m.email}</option>
        ))}
      </select>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={filters.overdueOnly} onChange={(e) => onChange({ ...filters, overdueOnly: e.target.checked })} />
          Overdue only
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={filters.mineOnly} onChange={(e) => onChange({ ...filters, mineOnly: e.target.checked })} />
          Mine only
        </label>
      </div>
    </div>
  );
}
