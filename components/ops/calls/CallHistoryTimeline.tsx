'use client';

import type { OpsCallActivity } from '@/lib/ops/calls/types';
import { CALL_STATUS_LABELS } from '@/lib/ops/calls/statuses';

function formatWhen(value: string) {
  try {
    return new Date(value).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return value;
  }
}

type CallHistoryTimelineProps = {
  activities: OpsCallActivity[];
};

export default function CallHistoryTimeline({ activities }: CallHistoryTimelineProps) {
  if (!activities.length) {
    return (
      <p className="text-sm text-slate-500">No call activity recorded yet.</p>
    );
  }

  return (
    <ol className="space-y-3">
      {activities.map((activity) => (
        <li
          key={activity.id}
          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">
              {CALL_STATUS_LABELS[activity.status]}
            </p>
            <p className="text-xs text-slate-500">{formatWhen(activity.createdAt)}</p>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            {activity.calledByName || activity.calledByEmail || 'Team member'}
            {activity.phone ? ` · ${activity.phone}` : ''}
          </p>
          {activity.nextFollowUpAt ? (
            <p className="mt-1 text-xs font-medium text-violet-700">
              Follow-up: {formatWhen(activity.nextFollowUpAt)}
            </p>
          ) : null}
          {activity.note ? (
            <p className="mt-2 text-sm text-slate-700">{activity.note}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
