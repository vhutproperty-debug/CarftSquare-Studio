'use client';

import type { OpsSupplyRecord } from '@/lib/ops/supply/types';

export default function AvailabilityCard({ record }: { record: OpsSupplyRecord }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Availability</h3>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-400">Status</dt>
          <dd className="font-semibold text-slate-900">{record.availabilityStatus || '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Available from</dt>
          <dd className="font-medium text-slate-800">
            {record.availableFrom ? new Date(record.availableFrom).toLocaleDateString('en-IN') : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">Keys available</dt>
          <dd className="font-medium text-slate-800">{record.keysAvailable ? 'Yes' : record.keysAvailable === false ? 'No' : '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Tenant occupied</dt>
          <dd className="font-medium text-slate-800">{record.tenantOccupied ? 'Yes' : record.tenantOccupied === false ? 'No' : '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Possession</dt>
          <dd className="font-medium text-slate-800">{record.possessionStatus || '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Agreement expiry</dt>
          <dd className={`font-medium ${record.agreementExpiry ? 'text-slate-800' : 'text-slate-500'}`}>
            {record.agreementExpiry ? new Date(record.agreementExpiry).toLocaleDateString('en-IN') : '—'}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-slate-400">Ready for matching</dt>
          <dd className={`font-bold ${record.readyForMatching ? 'text-emerald-700' : 'text-slate-600'}`}>
            {record.readyForMatching ? 'Yes' : 'No'}
          </dd>
        </div>
      </dl>
    </section>
  );
}
