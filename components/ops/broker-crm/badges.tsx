import { BROKER_CRM_STATUS_LABELS, type BrokerCrmStatus } from '@/lib/ops/broker-crm/types';

const STATUS_CLASS: Record<BrokerCrmStatus, string> = {
  new: 'bg-slate-100 text-slate-700',
  contacted: 'bg-sky-100 text-sky-950',
  active: 'bg-emerald-100 text-emerald-950',
  dormant: 'bg-amber-100 text-amber-950',
  'do-not-contact': 'bg-rose-100 text-rose-950',
};

export function StatusBadge({ status }: { status: BrokerCrmStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_CLASS[status]}`}>
      {BROKER_CRM_STATUS_LABELS[status]}
    </span>
  );
}

export function PriorityBadge() {
  return (
    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-950">
      Priority
    </span>
  );
}

export function AdminBadge() {
  return (
    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
      Admin
    </span>
  );
}
