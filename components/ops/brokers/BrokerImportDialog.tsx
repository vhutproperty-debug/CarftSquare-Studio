'use client';

import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type {
  BrokerImportStageTimings,
  BrokerImportSummary,
  BrokerImportProgress,
} from '@/lib/ops/brokers/types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
  onViewInventory?: () => void;
  onViewReview?: () => void;
};

const STAGE_LABELS: Array<{ key: keyof BrokerImportStageTimings; label: string }> = [
  { key: 'upload', label: 'Upload' },
  { key: 'fileRead', label: 'File read' },
  { key: 'validation', label: 'Validation' },
  { key: 'whatsappParse', label: 'WhatsApp parse' },
  { key: 'messageExtraction', label: 'Message extraction' },
  { key: 'normalization', label: 'Normalization' },
  { key: 'deduplication', label: 'Deduplication' },
  { key: 'mongoQueries', label: 'MongoDB queries' },
  { key: 'bulkWrites', label: 'Bulk writes' },
  { key: 'responseGeneration', label: 'Response' },
  { key: 'total', label: 'Total' },
];

function formatMs(ms?: number): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export default function BrokerImportDialog({
  open,
  onOpenChange,
  onImported,
  onViewInventory,
  onViewReview,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<BrokerImportSummary | null>(null);
  const [progress, setProgress] = useState<BrokerImportProgress | null>(null);
  const [timings, setTimings] = useState<BrokerImportStageTimings | null>(null);

  function reset() {
    setFile(null);
    setGroupName('');
    setError('');
    setSummary(null);
    setProgress(null);
    setTimings(null);
    setLoading(false);
  }

  async function pollUntilDone(batchId: string): Promise<BrokerImportSummary> {
    const started = Date.now();
    const maxWaitMs = 5 * 60 * 1000;
    while (Date.now() - started < maxWaitMs) {
      const res = await fetch(`/api/ops/brokers/import/${batchId}/progress`, {
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Progress check failed.');
      }
      if (data.progress) setProgress(data.progress as BrokerImportProgress);
      if (data.stageTimings) setTimings(data.stageTimings as BrokerImportStageTimings);
      if (data.done && data.summary) {
        return data.summary as BrokerImportSummary;
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
    throw new Error('Import is still running. Check Imports tab for final status.');
  }

  async function handleImport() {
    if (!file) {
      setError('Select a WhatsApp .txt export file.');
      return;
    }
    if (!groupName.trim()) {
      setError('Enter the WhatsApp group name.');
      return;
    }

    setLoading(true);
    setError('');
    setProgress({
      phase: 'upload',
      percent: 0,
      processedCandidates: 0,
      totalCandidates: 0,
      message: 'Uploading…',
      updatedAt: new Date().toISOString(),
    });
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('groupName', groupName.trim());

      const res = await fetch('/api/ops/brokers/import', {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Import failed.');
        return;
      }

      if (data.stageTimings) setTimings(data.stageTimings as BrokerImportStageTimings);

      if (res.status === 202 && data.batchId) {
        if (data.progress) setProgress(data.progress as BrokerImportProgress);
        const finalSummary = await pollUntilDone(String(data.batchId));
        setSummary(finalSummary);
        setTimings(finalSummary.stageTimings || timings);
        onImported();
        return;
      }

      setSummary(data as BrokerImportSummary);
      setTimings((data as BrokerImportSummary).stageTimings || null);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const duplicatesRefreshed =
    (summary?.updatedListings || 0) + (summary?.duplicateListings || 0);
  /** Optional review items (parse failures / very-low confidence / extraction errors). */
  const parserFailures = summary?.reviewQueued || 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import WhatsApp export</DialogTitle>
          <DialogDescription>
            Upload a broker-group .txt chat. Listings are extracted, normalized, deduplicated,
            and indexed into searchable inventory immediately. Review is optional for parser
            failures only.
          </DialogDescription>
        </DialogHeader>

        {!summary ? (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                WhatsApp group name
              </label>
              <Input
                placeholder="e.g. OSC Brokers Thane"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Export file (.txt)
              </label>
              <Input
                type="file"
                accept=".txt,text/plain"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                disabled={loading}
              />
              {file ? (
                <p className="mt-1 text-xs text-slate-500">
                  {file.name} · {(file.size / 1024).toFixed(1)} KB
                </p>
              ) : null}
            </div>
            {loading && progress ? (
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="flex items-center justify-between text-slate-700">
                  <span>{progress.message || progress.phase}</span>
                  <span>{progress.percent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded bg-slate-200">
                  <div
                    className="h-full bg-slate-800 transition-all"
                    style={{ width: `${Math.max(2, progress.percent)}%` }}
                  />
                </div>
                {progress.totalCandidates > 0 ? (
                  <p className="text-xs text-slate-500">
                    Candidates {progress.processedCandidates}/{progress.totalCandidates}
                  </p>
                ) : null}
              </div>
            ) : null}
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          </div>
        ) : (
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
            {summary.alreadyProcessed ? (
              <p className="font-semibold text-amber-700">
                Exact file already imported — idempotent skip.
              </p>
            ) : summary.batch.importStatus === 'FAILED' ? (
              <p className="font-semibold text-rose-700">Import failed.</p>
            ) : (
              <p className="font-semibold text-emerald-700">Import complete.</p>
            )}
            {!summary.alreadyProcessed && summary.batch.importStatus !== 'FAILED' ? (
              <ul className="space-y-1 text-slate-700">
                <li>
                  <strong>{summary.createdListings}</strong> listings indexed.
                </li>
                <li>
                  <strong>{duplicatesRefreshed}</strong> duplicates refreshed.
                </li>
                <li>
                  <strong>{summary.lowConfidenceIndexed || 0}</strong> low-confidence.
                </li>
                <li>
                  <strong>{parserFailures}</strong> parser failures.
                </li>
              </ul>
            ) : (
              <ul className="grid grid-cols-2 gap-2 text-slate-700">
                <li>Messages parsed: <strong>{summary.messagesParsed}</strong></li>
                <li>Listing candidates: <strong>{summary.listingCandidates}</strong></li>
              </ul>
            )}
            {(summary.stageTimings || timings) ? (
              <div className="border-t border-slate-200 pt-2">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Stage timings
                </p>
                <ul className="grid grid-cols-2 gap-1 text-xs text-slate-600">
                  {STAGE_LABELS.map(({ key, label }) => {
                    const ms = (summary.stageTimings || timings)?.[key];
                    if (ms == null && key !== 'total') return null;
                    return (
                      <li key={key}>
                        {label}: <strong>{formatMs(ms)}</strong>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
            {summary.errors?.length ? (
              <div className="text-xs text-slate-500">
                Notes: {summary.errors.slice(0, 3).join(' · ')}
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter>
          {!summary ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={loading}>
                <Upload className="mr-2 h-4 w-4" />
                {loading ? 'Processing…' : 'Process import'}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  reset();
                  onOpenChange(false);
                  onViewReview?.();
                }}
              >
                View Review Queue
              </Button>
              <Button
                onClick={() => {
                  reset();
                  onOpenChange(false);
                  onViewInventory?.();
                }}
              >
                View Inventory
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
