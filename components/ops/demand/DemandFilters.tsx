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

const selectClass =
  'h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-orange-300';

export default function DemandFilters({ filters, onChange, team, currentUserId }: DemandFiltersProps) {
  function update<K extends keyof DemandFilterState>(key: K, value: DemandFilterState[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
      <div className="grid gap-2 lg:grid-cols-12">
        <Input
          placeholder="Search name, mobile, project…"
          value={filters.search}
          onChange={(e) => update('search', e.target.value)}
          className="h-8 lg:col-span-4"
        />
        <select
          className={`${selectClass} lg:col-span-2`}
          value={filters.source}
          onChange={(e) => update('source', e.target.value)}
          aria-label="Source filter"
        >
          <option value="all">All sources</option>
          {OPS_LEAD_SOURCES.map((s) => (
            <option key={s} value={s}>
              {OPS_LEAD_SOURCE_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          className={`${selectClass} lg:col-span-2`}
          value={filters.status}
          onChange={(e) => update('status', e.target.value)}
          aria-label="Status filter"
        >
          <option value="all">All statuses</option>
          {DEMAND_STATUSES.map((s) => (
            <option key={s} value={s}>
              {DEMAND_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          className={`${selectClass} lg:col-span-2`}
          value={filters.assignedTo}
          onChange={(e) => update('assignedTo', e.target.value)}
          aria-label="Assignee filter"
        >
          <option value="all">All assignees</option>
          {currentUserId ? <option value={currentUserId}>Assigned to me</option> : null}
          {team.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <select
          className={`${selectClass} lg:col-span-2`}
          value={filters.priority}
          onChange={(e) => update('priority', e.target.value)}
          aria-label="Priority filter"
        >
          <option value="all">All priorities</option>
          {DEMAND_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {DEMAND_PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <select
          className={selectClass}
          value={filters.rentBuy}
          onChange={(e) => update('rentBuy', e.target.value)}
          aria-label="Rent or buy"
        >
          <option value="all">Rent / Buy</option>
          <option value="rent">Rent</option>
          <option value="buy">Buy</option>
        </select>
        <Input
          placeholder="Project"
          value={filters.project}
          onChange={(e) => update('project', e.target.value)}
          className="h-8"
        />
        <Input
          placeholder="Building / area"
          value={filters.building}
          onChange={(e) => update('building', e.target.value)}
          className="h-8"
        />
        <Input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => update('dateFrom', e.target.value)}
          className="h-8"
          aria-label="From date"
        />
        <Input
          type="date"
          value={filters.dateTo}
          onChange={(e) => update('dateTo', e.target.value)}
          className="h-8"
          aria-label="To date"
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
          <label className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <input type="checkbox" checked={filters.mineOnly} onChange={(e) => update('mineOnly', e.target.checked)} />
            Mine
          </label>
          <label className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <input
              type="checkbox"
              checked={filters.followUpToday}
              onChange={(e) => update('followUpToday', e.target.checked)}
            />
            Follow-up today
          </label>
          <label className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <input
              type="checkbox"
              checked={filters.overdueOnly}
              onChange={(e) => update('overdueOnly', e.target.checked)}
            />
            Overdue
          </label>
        </div>
      </div>
    </div>
  );
}
