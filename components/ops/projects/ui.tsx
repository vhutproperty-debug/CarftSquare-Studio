import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const selectClass = 'h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

export function Notice({ tone, children }: { tone: 'error' | 'ok' | 'info'; children: ReactNode }) {
  const styles = {
    error: 'border-rose-200 bg-rose-50 text-rose-800',
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    info: 'border-slate-200 bg-white text-slate-600',
  };
  return <div className={`rounded-lg border px-4 py-3 text-sm ${styles[tone]}`}>{children}</div>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

const TONES = {
  orange: 'bg-orange-50 text-orange-800 ring-orange-200',
  sky: 'bg-sky-50 text-sky-800 ring-sky-200',
  emerald: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  rose: 'bg-rose-50 text-rose-800 ring-rose-200',
};

export function Pill({ children, tone = 'slate' }: { children: ReactNode; tone?: keyof typeof TONES }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${TONES[tone]}`}>{children}</span>;
}

export function ProjectsTabs() {
  const pathname = usePathname() || '';
  const tabs = [
    { href: '/ops/projects/developer', label: 'Developer inventory' },
    { href: '/ops/projects/resale', label: 'Resale inventory' },
  ];
  return (
    <div className="flex rounded-lg bg-slate-200/70 p-1">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

export function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 text-sm text-slate-800">{value || '—'}</div>
    </div>
  );
}
