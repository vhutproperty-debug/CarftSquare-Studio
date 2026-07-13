'use client';

import { Input } from '@/components/ui/input';
import { DEAL_PAYMENT_STATUSES, DEAL_PAYMENT_STATUS_LABELS, DEAL_STAGES, DEAL_STAGE_LABELS } from '@/lib/ops/deals/statuses';

export type DealFilterState = {
  search: string;
  project: string;
  broker: string;
  stage: string;
  transactionType: string;
  minProbability: string;
  paymentStatus: string;
  dateFrom: string;
  mineOnly: boolean;
  activeOnly: boolean;
};

type DealFiltersProps = {
  filters: DealFilterState;
  onChange: (filters: DealFilterState) => void;
  team: Array<{ id: string; name: string; email: string }>;
  currentUserId?: string;
};

export default function DealFilters({ filters, onChange, team, currentUserId }: DealFiltersProps) {
  function update<K extends keyof DealFilterState>(key: K, value: DealFilterState[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-4">
        <Input
          placeholder="Search deal #, client, project…"
          value={filters.search}
          onChange={(e) => update('search', e.target.value)}
          className="lg:col-span-2"
        />
        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          value={filters.stage}
          onChange={(e) => update('stage', e.target.value)}
        >
          <option value="all">All stages</option>
          {DEAL_STAGES.map((s) => (
            <option key={s} value={s}>{DEAL_STAGE_LABELS[s]}</option>
          ))}
        </select>
        <Input
          placeholder="Min probability %"
          type="number"
          min={0}
          max={100}
          value={filters.minProbability}
          onChange={(e) => update('minProbability', e.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Input placeholder="Project" value={filters.project} onChange={(e) => update('project', e.target.value)} />
        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          value={filters.transactionType}
          onChange={(e) => update('transactionType', e.target.value)}
        >
          <option value="all">Rent / Sale</option>
          <option value="rent">Rent</option>
          <option value="sale">Sale</option>
        </select>
        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          value={filters.broker}
          onChange={(e) => update('broker', e.target.value)}
        >
          <option value="all">All brokers</option>
          {currentUserId ? <option value={currentUserId}>My deals</option> : null}
          {team.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          value={filters.paymentStatus}
          onChange={(e) => update('paymentStatus', e.target.value)}
        >
          <option value="all">Payment status</option>
          {DEAL_PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>{DEAL_PAYMENT_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <Input type="date" value={filters.dateFrom} onChange={(e) => update('dateFrom', e.target.value)} />
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={filters.activeOnly} onChange={(e) => update('activeOnly', e.target.checked)} />
          Active deals only
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={filters.mineOnly} onChange={(e) => update('mineOnly', e.target.checked)} />
          Assigned to me
        </label>
      </div>
    </div>
  );
}
