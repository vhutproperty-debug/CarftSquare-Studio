'use client';

import Link from 'next/link';
import { OPS_PIPELINE, type PipelineStageId } from '@/lib/ops/business';

type OpsPipelineBarProps = {
  activeStage?: PipelineStageId;
  compact?: boolean;
};

export default function OpsPipelineBar({ activeStage, compact = true }: OpsPipelineBarProps) {
  return (
    <div
      className={`border-b border-slate-200 bg-slate-50/80 ${compact ? 'px-3 py-1.5 md:px-5' : 'px-4 py-2 md:px-5'}`}
      aria-label="Brokerage operations lifecycle"
    >
      <ol className="flex items-center gap-0.5 overflow-x-auto pb-0.5">
        {OPS_PIPELINE.map((stage, index) => {
          const isActive = activeStage === stage.id;
          const isLive = stage.status === 'active';
          const isPast = activeStage
            ? OPS_PIPELINE.findIndex((s) => s.id === activeStage) > index
            : false;

          const content = (
            <>
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : isPast
                      ? 'bg-emerald-100 text-emerald-700'
                      : isLive
                        ? 'bg-white text-slate-600 ring-1 ring-slate-200'
                        : 'bg-slate-100 text-slate-400'
                }`}
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <span
                className={`whitespace-nowrap text-[11px] font-semibold ${
                  isActive ? 'text-slate-900' : isLive ? 'text-slate-600' : 'text-slate-400'
                }`}
              >
                {stage.label}
              </span>
            </>
          );

          return (
            <li key={stage.id} className="flex shrink-0 items-center">
              {isLive ? (
                <Link
                  href={stage.href}
                  title={stage.description}
                  aria-current={isActive ? 'step' : undefined}
                  className={`inline-flex items-center gap-1 rounded px-1.5 py-1 transition-colors ${
                    isActive ? 'bg-white shadow-sm ring-1 ring-slate-200' : 'hover:bg-white/80'
                  }`}
                >
                  {content}
                </Link>
              ) : (
                <span
                  className="inline-flex items-center gap-1 rounded px-1.5 py-1 opacity-60"
                  title={stage.description}
                >
                  {content}
                </span>
              )}
              {index < OPS_PIPELINE.length - 1 ? (
                <span className="mx-0.5 text-[10px] text-slate-300" aria-hidden="true">
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
