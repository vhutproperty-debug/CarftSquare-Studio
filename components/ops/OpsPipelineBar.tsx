'use client';

import { OPS_PIPELINE, type PipelineStageId } from '@/lib/ops/business';

type OpsPipelineBarProps = {
  activeStage?: PipelineStageId;
  compact?: boolean;
};

export default function OpsPipelineBar({ activeStage, compact = false }: OpsPipelineBarProps) {
  return (
    <div
      className={`border-b border-slate-200/80 bg-white ${compact ? 'px-3 py-2' : 'px-4 py-3 md:px-6'}`}
      aria-label="Brokerage operations pipeline"
    >
      <ol className={`flex items-center ${compact ? 'gap-0.5 overflow-x-auto' : 'gap-1 overflow-x-auto'}`}>
        {OPS_PIPELINE.map((stage, index) => {
          const isActive = activeStage === stage.id;
          const isLive = stage.status === 'active';
          const isPast = activeStage
            ? OPS_PIPELINE.findIndex((s) => s.id === activeStage) > index
            : false;

          return (
            <li key={stage.id} className="flex shrink-0 items-center">
              <div
                className={`group relative flex items-center gap-1.5 rounded-md px-2 py-1 ${
                  compact ? 'text-[10px]' : 'text-xs'
                }`}
                title={stage.description}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    isActive
                      ? 'bg-slate-900 text-white ring-2 ring-orange-200'
                      : isPast
                        ? 'bg-emerald-100 text-emerald-800'
                        : isLive
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-slate-100 text-slate-400'
                  }`}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <span
                  className={`whitespace-nowrap font-semibold ${
                    isActive
                      ? 'text-slate-900'
                      : isLive
                        ? 'text-slate-700'
                        : 'text-slate-400'
                  }`}
                >
                  {stage.label}
                </span>
                {!isLive ? (
                  <span className="rounded bg-slate-100 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                    Soon
                  </span>
                ) : null}
              </div>
              {index < OPS_PIPELINE.length - 1 ? (
                <span
                  className={`mx-0.5 text-slate-300 ${compact ? 'text-xs' : 'text-sm'}`}
                  aria-hidden="true"
                >
                  →
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
