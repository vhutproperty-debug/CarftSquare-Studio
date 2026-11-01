import type { GapAction, GapRow } from '@/lib/ops/market/types';

function gapClass(action: GapAction): string {
  if (action === 'push_ads') return 'bg-sky-100 text-sky-950';
  if (action === 'broker_outreach') return 'bg-amber-100 text-amber-950';
  return 'bg-slate-50 text-slate-600';
}

function gapText(gap: number, action: GapAction): string {
  if (action === 'balanced') return '0 · Balanced';
  const signed = gap > 0 ? `+${gap}` : String(gap);
  return action === 'push_ads' ? `${signed} · Push ads` : `${signed} · Broker outreach`;
}

type GapGridProps = {
  rows: GapRow[];
};

export default function GapGrid({ rows }: GapGridProps) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
        No available flats or active requirements to compare yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap gap-3 border-b border-slate-200 px-4 py-3 text-xs text-slate-600">
        <span className="rounded-full bg-sky-100 px-2 py-1 font-semibold text-sky-950">Push ads — more flats than requirements</span>
        <span className="rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-950">Broker outreach — more requirements than flats</span>
        <span>Gap = available flats minus active requirements</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Project / locality</th>
              <th className="px-3 py-2">BHK</th>
              <th className="px-3 py-2">Rent flats</th>
              <th className="px-3 py-2">Rent requirements</th>
              <th className="px-3 py-2">Rent gap</th>
              <th className="px-3 py-2">Sale flats</th>
              <th className="px-3 py-2">Sale requirements</th>
              <th className="px-3 py-2">Sale gap</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-slate-100">
                <td className="px-3 py-3 font-medium text-slate-900">{row.project}</td>
                <td className="px-3 py-3">{row.bhk}</td>
                <td className="px-3 py-3 tabular-nums">{row.rentFlats}</td>
                <td className="px-3 py-3 tabular-nums">{row.rentRequirements}</td>
                <td className="px-3 py-3">
                  <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${gapClass(row.rentAction)}`}>
                    {gapText(row.rentGap, row.rentAction)}
                  </span>
                </td>
                <td className="px-3 py-3 tabular-nums">{row.saleFlats}</td>
                <td className="px-3 py-3 tabular-nums">{row.saleRequirements}</td>
                <td className="px-3 py-3">
                  <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${gapClass(row.saleAction)}`}>
                    {gapText(row.saleGap, row.saleAction)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
