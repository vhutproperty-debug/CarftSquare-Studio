'use client';

import { Input } from '@/components/ui/input';
import { SUPPLY_PRIORITIES, SUPPLY_STATUSES } from '@/lib/ops/supply/statuses';
import { SUPPLY_PRIORITY_LABELS, SUPPLY_STATUS_LABELS } from '@/lib/ops/supply/statuses';

export type SupplyFilterState = {
  search: string;
  sort: string;
  sortDir: string;
  project: string;
  building: string;
  configuration: string;
  listingType: string;
  assignedBroker: string;
  availabilityStatus: string;
  exclusive: boolean;
  keysAvailable: boolean;
  agreementExpiring: boolean;
  readyForMatching: boolean;
  status: string;
  priority: string;
  mineOnly: boolean;
  followUpToday: boolean;
  overdueOnly: boolean;
};

type SupplyFiltersProps = {
  filters: SupplyFilterState;
  onChange: (filters: SupplyFilterState) => void;
  team: Array<{ id: string; name: string; email: string }>;
  currentUserId?: string;
};

export default function SupplyFilters({ filters, onChange, team, currentUserId }: SupplyFiltersProps) {
  function update<K extends keyof SupplyFilterState>(key: K, value: SupplyFilterState[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-4">
        <Input
          placeholder="Search project, building, owner, flat…"
          value={filters.search}
          onChange={(e) => update('search', e.target.value)}
          className="lg:col-span-2"
        />
        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          value={filters.status}
          onChange={(e) => update('status', e.target.value)}
        >
          <option value="all">All statuses</option>
          {SUPPLY_STATUSES.map((s) => (
            <option key={s} value={s}>{SUPPLY_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          value={filters.priority}
          onChange={(e) => update('priority', e.target.value)}
        >
          <option value="all">All priorities</option>
          {SUPPLY_PRIORITIES.map((p) => (
            <option key={p} value={p}>{SUPPLY_PRIORITY_LABELS[p]}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Input placeholder="Project" value={filters.project} onChange={(e) => update('project', e.target.value)} />
        <Input placeholder="Building" value={filters.building} onChange={(e) => update('building', e.target.value)} />
        <Input placeholder="Config (BHK)" value={filters.configuration} onChange={(e) => update('configuration', e.target.value)} />
        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          value={filters.listingType}
          onChange={(e) => update('listingType', e.target.value)}
        >
          <option value="all">Rent / Sale</option>
          <option value="rent">Rent</option>
          <option value="sale">Sale</option>
        </select>
        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          value={filters.assignedBroker}
          onChange={(e) => update('assignedBroker', e.target.value)}
        >
          <option value="all">All brokers</option>
          {currentUserId ? <option value={currentUserId}>Assigned to me</option> : null}
          {team.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          value={filters.sort}
          onChange={(e) => update('sort', e.target.value)}
        >
          <option value="updatedAt">Sort: Updated</option>
          <option value="createdAt">Sort: Created</option>
          <option value="project">Sort: Project</option>
          <option value="building">Sort: Building</option>
          <option value="agreementExpiry">Sort: Agreement</option>
          <option value="priority">Sort: Priority</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={filters.exclusive} onChange={(e) => update('exclusive', e.target.checked)} />
          Exclusive only
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={filters.keysAvailable} onChange={(e) => update('keysAvailable', e.target.checked)} />
          Keys available
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={filters.readyForMatching} onChange={(e) => update('readyForMatching', e.target.checked)} />
          Ready for matching
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={filters.agreementExpiring} onChange={(e) => update('agreementExpiring', e.target.checked)} />
          Agreement expiring (30d)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={filters.mineOnly} onChange={(e) => update('mineOnly', e.target.checked)} />
          My listings
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={filters.followUpToday} onChange={(e) => update('followUpToday', e.target.checked)} />
          Follow-ups today
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={filters.overdueOnly} onChange={(e) => update('overdueOnly', e.target.checked)} />
          Overdue follow-ups
        </label>
      </div>
    </div>
  );
}
