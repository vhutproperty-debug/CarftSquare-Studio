'use client';

export default function ConfidenceBadge({ value }: { value?: number }) {
  if (value == null) {
    return <span className="text-[11px] text-slate-400">—</span>;
  }
  const tone =
    value >= 73
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : value >= 46
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-rose-50 text-rose-700 border-rose-200';
  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      {value}%
    </span>
  );
}
