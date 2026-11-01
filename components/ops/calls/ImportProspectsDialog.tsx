'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type ImportRow = {
  index: number;
  action: 'create' | 'update' | 'skip';
  name?: string;
  phone?: string;
  reason?: string;
};

type ImportPlan = {
  dryRun: boolean;
  summary: { total: number; creates: number; updates: number; skips: number };
  rows: ImportRow[];
};

type ImportProspectsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
};

export default function ImportProspectsDialog({
  open,
  onOpenChange,
  onImported,
}: ImportProspectsDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [loading, setLoading] = useState<'preview' | 'commit' | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function reset() {
    setFile(null);
    setPlan(null);
    setError('');
    setMessage('');
    setLoading(null);
  }

  async function submit(dryRun: boolean) {
    if (!file) {
      setError('Choose a CSV or JSON file.');
      return;
    }
    setLoading(dryRun ? 'preview' : 'commit');
    setError('');
    setMessage('');
    try {
      const body = new FormData();
      body.set('file', file);
      body.set('dryRun', dryRun ? 'true' : 'false');
      const response = await fetch('/api/ops/prospects/import', {
        method: 'POST',
        credentials: 'include',
        body,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Import failed.');
        return;
      }
      setPlan(data);
      if (dryRun) {
        setMessage('Preview only. Nothing was written.');
        return;
      }
      setMessage(
        `Imported ${data.summary?.creates || 0} new and updated ${data.summary?.updates || 0}. Skipped ${data.summary?.skips || 0}.`,
      );
      onImported();
    } catch {
      setError('Import failed.');
    } finally {
      setLoading(null);
    }
  }

  const previewRows = (plan?.rows || []).slice(0, 30);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Import owners</DialogTitle>
          <DialogDescription>
            Upload a CSV or JSON file of prospects. Preview creates, updates, and skips, then commit.
            Matching is by normalized phone. Opted-out owners stay opted out.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700" htmlFor="prospect-import-file">
            CSV or JSON
          </label>
          <input
            id="prospect-import-file"
            type="file"
            accept=".csv,.json,text/csv,application/json"
            className="block w-full text-sm"
            onChange={(event) => {
              setFile(event.target.files?.[0] || null);
              setPlan(null);
              setMessage('');
              setError('');
            }}
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={!file || loading != null} onClick={() => submit(true)}>
              {loading === 'preview' ? 'Previewing…' : 'Dry-run preview'}
            </Button>
            <Button type="button" disabled={!file || !plan?.dryRun || loading != null} onClick={() => submit(false)}>
              {loading === 'commit' ? 'Importing…' : 'Commit import'}
            </Button>
          </div>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {message ? <p className="text-sm text-slate-600">{message}</p> : null}
          {plan ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-800">
                {plan.summary.creates} create · {plan.summary.updates} update · {plan.summary.skips} skip
                {' '}({plan.summary.total} rows)
              </p>
              <div className="max-h-64 overflow-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-2 py-1.5">Action</th>
                      <th className="px-2 py-1.5">Name</th>
                      <th className="px-2 py-1.5">Phone</th>
                      <th className="px-2 py-1.5">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row) => (
                      <tr key={`${row.index}-${row.phone || row.reason}`} className="border-t border-slate-100">
                        <td className="px-2 py-1.5 font-medium">{row.action}</td>
                        <td className="px-2 py-1.5">{row.name || '—'}</td>
                        <td className="px-2 py-1.5">{row.phone || '—'}</td>
                        <td className="px-2 py-1.5 text-slate-500">{row.reason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {plan.rows.length > previewRows.length ? (
                <p className="text-xs text-slate-500">Showing the first {previewRows.length} rows.</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
