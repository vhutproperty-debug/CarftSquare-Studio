'use client';

import type { DemandSourceBreakdownItem } from '@/lib/ops/demand/types';

export default function DemandSourceBreakdown({ items }: { items: DemandSourceBreakdownItem[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Source breakdown</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.channelId}
            className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
              item.live ? 'border-slate-100 bg-slate-50' : 'border-dashed border-slate-200 bg-white opacity-70'
            }`}
          >
            <span className="text-sm font-medium text-slate-700">
              {item.label}
              {!item.live ? (
                <span className="ml-2 text-[10px] font-bold uppercase text-slate-400">Soon</span>
              ) : null}
            </span>
            <span className="text-sm font-bold text-slate-900">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
