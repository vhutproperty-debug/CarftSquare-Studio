'use client';

const DISPLAY_TOTAL_STEPS = 8;

export function getEstimateProgress(answeredCount: number, phase: string) {
  if (phase === 'summary' || phase === 'lead_prompt' || phase === 'lead' || phase === 'followup' || phase === 'complete') {
    return { step: DISPLAY_TOTAL_STEPS, percent: 100 };
  }
  const step = Math.min(DISPLAY_TOTAL_STEPS, Math.max(1, answeredCount + 1));
  const percent = Math.min(95, Math.round((answeredCount / (DISPLAY_TOTAL_STEPS - 1)) * 100));
  return { step, percent: Math.max(5, percent) };
}

export default function EstimateProgress({
  step,
  percent,
}: {
  step: number;
  percent: number;
}) {
  return (
    <div className="estimate-fade-in fixed right-4 top-20 z-30 hidden w-44 rounded-2xl estimate-glass-card p-4 md:block lg:right-8">
      <p className="text-right text-xs font-bold uppercase tracking-wider text-slate-500">
        {percent}% Complete
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="estimate-progress-fill h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-right text-[10px] font-semibold text-slate-400">
        Step {step} of {DISPLAY_TOTAL_STEPS}
      </p>
    </div>
  );
}
