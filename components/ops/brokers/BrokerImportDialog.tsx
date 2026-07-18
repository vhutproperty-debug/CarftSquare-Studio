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
import type { BrokerImportSummary } from '@/lib/ops/brokers/types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
};

export default function BrokerImportDialog({ open, onOpenChange, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<BrokerImportSummary | null>(null);

  function reset() {
    setFile(null);
    setGroupName('');
    setError('');
    setSummary(null);
    setLoading(false);
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
      setSummary(data as BrokerImportSummary);
      onImported();
    } catch {
      setError('Import failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

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
            Upload a manually exported broker-group .txt chat. The engine parses messages,
            extracts listings, and refreshes existing inventory without discarding source text.
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
              />
              {file ? (
                <p className="mt-1 text-xs text-slate-500">
                  {file.name} · {(file.size / 1024).toFixed(1)} KB
                </p>
              ) : null}
            </div>
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
            ) : summary.batch.importStatus === 'PARTIAL'
              || summary.batch.importStatus === 'COMPLETED_WITH_ERRORS' ? (
              <p className="font-semibold text-amber-700">
                Import finished with partial results.
              </p>
            ) : (
              <p className="font-semibold text-emerald-700">Import completed.</p>
            )}
            <ul className="grid grid-cols-2 gap-2 text-slate-700">
              <li>Messages parsed: <strong>{summary.messagesParsed}</strong></li>
              <li>Listing candidates: <strong>{summary.listingCandidates}</strong></li>
              <li>Created: <strong>{summary.createdListings}</strong></li>
              <li>Refreshed: <strong>{summary.updatedListings}</strong></li>
              <li>Pure reposts: <strong>{summary.duplicateListings}</strong></li>
              <li>Failed: <strong>{summary.failedMessages}</strong></li>
            </ul>
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
            <Button onClick={() => { reset(); onOpenChange(false); }}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
