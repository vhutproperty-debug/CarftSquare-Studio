'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  OPS_LEAD_CATEGORY_LABELS,
  OPS_LEAD_SOURCE_LABELS,
  OPS_LEAD_SOURCES,
  type OpsLeadCategory,
  type OpsLeadSource,
} from '@/lib/ops/leads/types';

export type LeadFilterState = {
  search: string;
  source: OpsLeadSource | 'all';
  category: OpsLeadCategory | 'all';
};

type LeadFiltersProps = {
  filters: LeadFilterState;
  onChange: (next: LeadFilterState) => void;
};

export default function LeadFilters({ filters, onChange }: LeadFiltersProps) {
  return (
    <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
      <label className="relative block">
        <span className="sr-only">Search leads</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder="Search name, phone, project…"
          className="pl-9"
        />
      </label>
      <select
        value={filters.source}
        onChange={(event) => onChange({
          ...filters,
          source: event.target.value as LeadFilterState['source'],
        })}
        className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        aria-label="Filter by source"
      >
        <option value="all">All sources</option>
        {OPS_LEAD_SOURCES.map((source) => (
          <option key={source} value={source}>
            {OPS_LEAD_SOURCE_LABELS[source]}
          </option>
        ))}
      </select>
      <select
        value={filters.category}
        onChange={(event) => onChange({
          ...filters,
          category: event.target.value as LeadFilterState['category'],
        })}
        className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        aria-label="Filter by category"
      >
        <option value="all">All categories</option>
        {(Object.keys(OPS_LEAD_CATEGORY_LABELS) as OpsLeadCategory[]).map((category) => (
          <option key={category} value={category}>
            {OPS_LEAD_CATEGORY_LABELS[category]}
          </option>
        ))}
      </select>
    </div>
  );
}
