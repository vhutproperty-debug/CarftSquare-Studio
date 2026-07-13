'use client';

import { Input } from '@/components/ui/input';
import { AGREEMENT_STATUSES, AGREEMENT_STATUS_LABELS } from '@/lib/ops/agreements/statuses';

export type AgreementFilterState = {
  search: string;
  status: string;
  expiringOnly: boolean;
  broker: string;
};

type AgreementFiltersProps = {
  filters: AgreementFilterState;
  onChange: (filters: AgreementFilterState) => void;
  team: Array<{ id: string; name: string; email: string }>;
};

export default function AgreementFilters({ filters, onChange, team }: AgreementFiltersProps) {
  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-5">
      <Input placeholder="Search deal, client, project…" value={filters.search} onChange={(e) => onChange({ ...filters, search: e.target.value })} className="xl:col-span-2" />
      <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" value={filters.status} onChange={(e) => onChange({ ...filters, status: e.target.value })}>
        <option value="all">All statuses</option>
        {AGREEMENT_STATUSES.map((s) => <option key={s} value={s}>{AGREEMENT_STATUS_LABELS[s]}</option>)}
      </select>
      <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" value={filters.broker} onChange={(e) => onChange({ ...filters, broker: e.target.value })}>
        <option value="all">All brokers</option>
        {team.map((m) => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
      </select>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={filters.expiringOnly} onChange={(e) => onChange({ ...filters, expiringOnly: e.target.checked })} />
        Expiring within 30 days
      </label>
    </div>
  );
}
