'use client';

import type { OpsSupplyRecord } from '@/lib/ops/supply/types';
import { formatPhoneDisplay } from '@/lib/ops/phone';
import { SUPPLY_SOURCE_LABELS } from '@/lib/ops/supply/statuses';

export default function OwnerCard({ record }: { record: OpsSupplyRecord }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Owner</h3>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-400">Name</dt>
          <dd className="font-semibold text-slate-900">{record.ownerName || '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Mobile</dt>
          <dd className="font-semibold text-slate-900">{formatPhoneDisplay(record.ownerMobile) || '—'}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-slate-400">Email</dt>
          <dd className="font-medium text-slate-800">{record.ownerEmail || '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Source</dt>
          <dd className="font-medium text-slate-800">{SUPPLY_SOURCE_LABELS[record.source]}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Last contact</dt>
          <dd className="font-medium text-slate-800">
            {record.lastContactAt ? new Date(record.lastContactAt).toLocaleDateString('en-IN') : '—'}
          </dd>
        </div>
      </dl>
    </section>
  );
}
