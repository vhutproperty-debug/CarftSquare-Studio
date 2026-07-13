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
  variant?: 'default' | 'workspace';
};

export default function CallHistoryTimeline({ activities, variant = 'default' }: CallHistoryTimelineProps) {
  if (!activities.length) {
    return (
      <p className="text-sm text-slate-500">No conversations recorded yet. Log your first call from the action panel.</p>
    );
  }

  if (variant === 'workspace') {
    return (
      <ol className="relative space-y-0">
        {activities.map((activity, index) => (
          <li key={activity.id} className="relative pb-6 pl-6 last:pb-0">
            {index < activities.length - 1 ? (
              <span className="absolute left-[7px] top-3 h-full w-px bg-slate-200" aria-hidden="true" />
            ) : null}
            <span
              className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-slate-400 shadow-sm ring-2 ring-slate-100"
              aria-hidden="true"
            />
            <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-bold text-slate-900">{CALL_STATUS_LABELS[activity.status]}</p>
                <time className="text-[11px] text-slate-500">{formatWhen(activity.createdAt)}</time>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {activity.calledByName || activity.calledByEmail || 'Team member'}
              </p>
              {activity.nextFollowUpAt ? (
                <p className="mt-1 text-xs font-semibold text-violet-700">
                  Follow-up scheduled: {formatWhen(activity.nextFollowUpAt)}
                </p>
              ) : null}
              {activity.note ? (
                <p className="mt-2 text-sm leading-relaxed text-slate-700">{activity.note}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
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
