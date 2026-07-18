'use client';

import { useCallback, useEffect, useState } from 'react';
import { BROKER_IMPORT_STATUS_LABELS, normalizeImportStatusForUi } from '@/lib/ops/brokers/statuses';
import type { BrokerBatchQualityDetail, OpsBrokerImportBatch } from '@/lib/ops/brokers/types';

export default function BrokerImportsPanel() {
  const [batches, setBatches] = useState<OpsBrokerImportBatch[]>([]);
  const [selected, setSelected] = useState<BrokerBatchQualityDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ops/brokers/batches?pageSize=30', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setBatches(data.items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function openBatch(id: string) {
    const res = await fetch(`/api/ops/brokers/batches/${id}`, { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setSelected(data.quality || null);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-2">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Import history</h3>
        {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}
        {!loading && !batches.length ? (
          <p className="rounded-xl border border-dashed bg-white p-6 text-sm text-slate-500">
            No imports yet. Upload a WhatsApp .txt export to begin.
          </p>
        ) : null}
        {batches.map((b) => {
          const status = normalizeImportStatusForUi(b.importStatus);
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => openBatch(b.id)}
              className="w-full rounded-lg border bg-white px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              <div className="flex justify-between gap-2">
                <span className="font-semibold text-slate-900">{b.groupName}</span>
                <span className="text-xs text-slate-500">{BROKER_IMPORT_STATUS_LABELS[status]}</span>
              </div>
              <p className="text-xs text-slate-500">
                {b.fileName} · {new Date(b.uploadedAt).toLocaleString('en-IN')}
              </p>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Batch quality</h3>
        {!selected ? (
          <p className="mt-3 text-sm text-slate-500">Select a batch to inspect quality metrics.</p>
        ) : (
          <div className="mt-3 space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Messages parsed" value={selected.messagesParsed} />
              <Stat label="Candidates" value={selected.listingCandidates} />
              <Stat label="Extracted" value={selected.listingsExtracted} />
              <Stat label="New" value={selected.newInventory} />
              <Stat label="Updated" value={selected.updatedInventory} />
              <Stat label="Review queue" value={selected.reviewQueue} />
              <Stat label="Skipped" value={selected.skipped} />
              <Stat label="Malformed" value={selected.malformed} />
              <Stat label="Failed" value={selected.failed} />
              <Stat label="Unknown projects" value={selected.unknownProjects} />
              <Stat label="Avg confidence" value={`${selected.averageConfidence}%`} />
            </div>
            {selected.topProjects.length ? (
              <div>
                <p className="text-[11px] font-bold uppercase text-slate-400">Top projects</p>
                <ul className="mt-1 space-y-1">
                  {selected.topProjects.map((p) => (
                    <li key={p.name} className="flex justify-between text-slate-700">
                      <span>{p.name}</span><span>{p.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-bold uppercase text-slate-400">{label}</p>
      <p className="font-semibold text-slate-900">{value}</p>
    </div>
  );
}
