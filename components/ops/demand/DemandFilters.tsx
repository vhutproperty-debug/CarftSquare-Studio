'use client';

import { Input } from '@/components/ui/input';
import { DEMAND_PRIORITIES, DEMAND_STATUSES } from '@/lib/ops/demand/statuses';
import { DEMAND_STATUS_LABELS, DEMAND_PRIORITY_LABELS } from '@/lib/ops/demand/statuses';
import { OPS_LEAD_SOURCES, OPS_LEAD_SOURCE_LABELS } from '@/lib/ops/leads/types';

export type DemandFilterState = {
  search: string;
  source: string;
  status: string;
  priority: string;
  assignedTo: string;
  rentBuy: string;
  project: string;
  building: string;
  dateFrom: string;
  dateTo: string;
  mineOnly: boolean;
  followUpToday: boolean;
  overdueOnly: boolean;
};

type DemandFiltersProps = {
  filters: DemandFilterState;
  onChange: (filters: DemandFilterState) => void;
  team: Array<{ id: string; name: string; email: string }>;
  currentUserId?: string;
};

export default function DemandFilters({ filters, onChange, team, currentUserId }: DemandFiltersProps) {
  function update<K extends keyof DemandFilterState>(key: K, value: DemandFilterState[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-4">
        <Input
          placeholder="Search name, mobile, project…"
          value={filters.search}
          onChange={(e) => update('search', e.target.value)}
          className="lg:col-span-2"
        />
        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          value={filters.source}
          onChange={(e) => update('source', e.target.value)}
        >
          <option value="all">All sources</option>
          {OPS_LEAD_SOURCES.map((s) => (
            <option key={s} value={s}>{OPS_LEAD_SOURCE_LABELS[s]}</option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          value={filters.status}
          onChange={(e) => update('status', e.target.value)}
        >
          <option value="all">All statuses</option>
          {DEMAND_STATUSES.map((s) => (
            <option key={s} value={s}>{DEMAND_STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          value={filters.priority}
          onChange={(e) => update('priority', e.target.value)}
        >
          <option value="all">All priorities</option>
          {DEMAND_PRIORITIES.map((p) => (
            <option key={p} value={p}>{DEMAND_PRIORITY_LABELS[p]}</option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          value={filters.assignedTo}
          onChange={(e) => update('assignedTo', e.target.value)}
        >
          <option value="all">All assignees</option>
          {currentUserId ? (
            <option value={currentUserId}>Assigned to me</option>
          ) : null}
          {team.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          value={filters.rentBuy}
          onChange={(e) => update('rentBuy', e.target.value)}
        >
          <option value="all">Rent / Buy</option>
          <option value="rent">Rent</option>
          <option value="buy">Buy</option>
        </select>
        <Input
          placeholder="Project"
          value={filters.project}
          onChange={(e) => update('project', e.target.value)}
        />
        <Input
          placeholder="Building / area"
          value={filters.building}
          onChange={(e) => update('building', e.target.value)}
        />
        <Input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => update('dateFrom', e.target.value)}
        />
        <Input
          type="date"
          placeholder="To date"
          value={filters.dateTo}
          onChange={(e) => update('dateTo', e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={filters.mineOnly} onChange={(e) => update('mineOnly', e.target.checked)} />
          My enquiries only
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={filters.followUpToday} onChange={(e) => update('followUpToday', e.target.checked)} />
          Follow-ups today
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={filters.overdueOnly} onChange={(e) => update('overdueOnly', e.target.checked)} />
          Overdue only
        </label>
      </div>
    </div>
  );
}
