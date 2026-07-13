'use client';

import { Input } from '@/components/ui/input';
import { MATCH_STATUSES, MATCH_STATUS_LABELS } from '@/lib/ops/matching/statuses';

export type MatchFilterState = {
  search: string;
  project: string;
  broker: string;
  configuration: string;
  listingType: string;
  minScore: string;
  status: string;
  assignedBroker: string;
  dateFrom: string;
  dateTo: string;
  mineOnly: boolean;
};

type MatchFiltersProps = {
  filters: MatchFilterState;
  onChange: (filters: MatchFilterState) => void;
  team: Array<{ id: string; name: string; email: string }>;
  currentUserId?: string;
};

export default function MatchFilters({ filters, onChange, team, currentUserId }: MatchFiltersProps) {
  function update<K extends keyof MatchFilterState>(key: K, value: MatchFilterState[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-4">
        <Input
          placeholder="Search demand, supply, project…"
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
          {MATCH_STATUSES.map((s) => (
            <option key={s} value={s}>{MATCH_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <Input
          placeholder="Min score"
          type="number"
          min={0}
          max={100}
          value={filters.minScore}
          onChange={(e) => update('minScore', e.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Input placeholder="Project" value={filters.project} onChange={(e) => update('project', e.target.value)} />
        <Input placeholder="Configuration" value={filters.configuration} onChange={(e) => update('configuration', e.target.value)} />
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
        <Input type="date" value={filters.dateFrom} onChange={(e) => update('dateFrom', e.target.value)} />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={filters.mineOnly} onChange={(e) => update('mineOnly', e.target.checked)} />
        My matches only
      </label>
    </div>
  );
}
