'use client';

import { Input } from '@/components/ui/input';

export type BrokersFilterState = {
  search: string;
  project: string;
  transactionType: string;
  bhk: string;
  freshness: string;
  broker: string;
  group: string;
  furnishing: string;
  sort: string;
  sortDir: string;
};

type BrokersFiltersProps = {
  filters: BrokersFilterState;
  onChange: (filters: BrokersFilterState) => void;
  filterOptions: {
    projects: string[];
    brokers: string[];
    groups: string[];
  };
};

export default function BrokersFilters({ filters, onChange, filterOptions }: BrokersFiltersProps) {
  function update<K extends keyof BrokersFilterState>(key: K, value: BrokersFilterState[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-4">
        <Input
          placeholder="Search project, broker, unit, phone…"
          value={filters.search}
          onChange={(e) => update('search', e.target.value)}
          className="lg:col-span-2"
        />
        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          value={filters.freshness}
          onChange={(e) => update('freshness', e.target.value)}
        >
          <option value="all">All freshness</option>
          <option value="FRESH">Fresh</option>
          <option value="AGING">Aging</option>
          <option value="STALE">Stale</option>
        </select>
        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          value={filters.transactionType}
          onChange={(e) => update('transactionType', e.target.value)}
        >
          <option value="all">All transactions</option>
          <option value="RENT">Rent</option>
          <option value="SALE">Sale</option>
          <option value="UNKNOWN">Unknown</option>
        </select>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Input
          placeholder="BHK"
          value={filters.bhk}
          onChange={(e) => update('bhk', e.target.value)}
        />
        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          value={filters.project}
          onChange={(e) => update('project', e.target.value)}
        >
          <option value="">All projects</option>
          {filterOptions.projects.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          value={filters.broker}
          onChange={(e) => update('broker', e.target.value)}
        >
          <option value="">All brokers</option>
          {filterOptions.brokers.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          value={filters.group}
          onChange={(e) => update('group', e.target.value)}
        >
          <option value="">All groups</option>
          {filterOptions.groups.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          value={filters.furnishing}
          onChange={(e) => update('furnishing', e.target.value)}
        >
          <option value="all">All furnishing</option>
          <option value="FURNISHED">Furnished</option>
          <option value="SEMI_FURNISHED">Semi furnished</option>
          <option value="UNFURNISHED">Unfurnished</option>
          <option value="UNKNOWN">Unknown</option>
        </select>
      </div>
    </div>
  );
}
