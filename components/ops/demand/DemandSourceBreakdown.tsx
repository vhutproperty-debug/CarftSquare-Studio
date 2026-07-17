'use client';

import type { DemandSourceBreakdownItem } from '@/lib/ops/demand/types';

function sourceTone(channelId: string, live: boolean) {
  if (!live) return 'border-dashed border-slate-200 bg-white text-slate-400';
  if (channelId.includes('housing') && channelId.includes('api')) {
    return 'border-sky-200 bg-sky-50 text-sky-900';
  }
  if (channelId.includes('housing')) {
    return 'border-indigo-200 bg-indigo-50 text-indigo-900';
  }
  if (channelId.includes('craftsquare') || channelId.includes('website')) {
    return 'border-orange-200 bg-orange-50 text-orange-900';
  }
  return 'border-slate-200 bg-slate-50 text-slate-800';
}

export default function DemandSourceBreakdown({ items }: { items: DemandSourceBreakdownItem[] }) {
  if (!items.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Sources</span>
      {items.map((item) => (
        <span
          key={item.channelId}
          title={!item.live ? 'Coming soon' : item.label}
          className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${sourceTone(
            item.channelId,
            item.live,
          )}`}
        >
          <span className="truncate">{item.label}</span>
          {!item.live ? (
            <span className="text-[9px] font-bold uppercase opacity-70">Soon</span>
          ) : (
            <span className="tabular-nums font-bold">{item.count}</span>
          )}
        </span>
      ))}
    </div>
  );
}
