'use client';

import type { OpsSupplyActivity } from '@/lib/ops/supply/types';
import { SUPPLY_ACTIVITY_LABELS } from '@/lib/ops/supply/statuses';

function formatWhen(value: string) {
  try {
    return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return value;
  }
}

export default function SupplyTimeline({ activities }: { activities: OpsSupplyActivity[] }) {
  if (!activities.length) {
    return <p className="text-sm text-slate-500">No activity recorded yet.</p>;
  }

  return (
    <ol className="space-y-2">
      {activities.map((activity) => (
        <li key={activity.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {SUPPLY_ACTIVITY_LABELS[activity.type]}
            </p>
            <time className="text-[11px] text-slate-400">{formatWhen(activity.createdAt)}</time>
          </div>
          <p className="mt-1 text-sm text-slate-800">{activity.message}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {activity.actorName || activity.actorEmail || 'Team'}
          </p>
        </li>
      ))}
    </ol>
  );
}
