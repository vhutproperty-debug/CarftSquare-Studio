'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Summary = {
  openDuplicateReviews: number;
  agreementTerms: number;
};

export default function WorkspaceSummaryStrip() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/ops/workspace/summary', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!cancelled && data) setSummary(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!summary) return null;

  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-3">
      <Link href="/ops/contacts/duplicates" className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Duplicate reviews</p>
        <p className="text-2xl font-black">{summary.openDuplicateReviews}</p>
      </Link>
      <Link href="/ops/contacts/queue" className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Cold calls</p>
        <p className="text-sm font-semibold text-slate-700">Open the existing queue</p>
      </Link>
      <Link href="/ops/agreements" className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Agreement terms</p>
        <p className="text-2xl font-black">{summary.agreementTerms}</p>
      </Link>
    </div>
  );
}
