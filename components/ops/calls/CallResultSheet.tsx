'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  CALL_STATUS_LABELS,
  MORE_CALL_RESULTS,
  QUICK_CALL_RESULTS,
  requiresFollowUp,
  type CallActivityStatus,
} from '@/lib/ops/calls/statuses';
import type { CallTargetSummary } from '@/lib/ops/calls/types';
import { isSuperAdmin } from '@/lib/auth/rbac/client';

type CallTarget = {
  targetType: 'unified_lead' | 'ops_prospect';
  targetSource?: string;
  targetId: string;
  phone: string;
};

type CallResultSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: CallTarget;
  currentSummary?: CallTargetSummary;
  currentUser?: { id?: string; role?: string; isSuperAdmin?: boolean } | null;
  onSaved: (payload: { summary: CallTargetSummary }) => void;
};

export default function CallResultSheet({
  open,
  onOpenChange,
  target,
  currentSummary,
  currentUser,
  onSaved,
}: CallResultSheetProps) {
  const [selectedStatus, setSelectedStatus] = useState<CallActivityStatus | null>(null);
  const [note, setNote] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpTime, setFollowUpTime] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [confirmDoNotCall, setConfirmDoNotCall] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const adminOverride = currentSummary?.doNotCall && isSuperAdmin(currentUser);

  function resetForm() {
    setSelectedStatus(null);
    setNote('');
    setFollowUpDate('');
    setFollowUpTime('');
    setShowMore(false);
    setError('');
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm();
    onOpenChange(next);
  }

  function pickStatus(status: CallActivityStatus) {
    if (status === 'DO_NOT_CALL') {
      setConfirmDoNotCall(true);
      return;
    }
    setSelectedStatus(status);
  }

  async function saveResult(status: CallActivityStatus, adminOverrideDoNotCall = false) {
    setLoading(true);
    setError('');

    let nextFollowUpAt: string | undefined;
    if (requiresFollowUp(status)) {
      if (!followUpDate || !followUpTime) {
        setError('Please select follow-up date and time.');
        setLoading(false);
        return;
      }
      nextFollowUpAt = new Date(`${followUpDate}T${followUpTime}:00`).toISOString();
    }

    try {
      const response = await fetch('/api/ops/calls/activities', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: target.targetType,
          targetSource: target.targetSource,
          targetId: target.targetId,
          phone: target.phone,
          status,
          note: note.trim() || undefined,
          nextFollowUpAt,
          adminOverrideDoNotCall,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Unable to save call result.');
        return;
      }
      onSaved({ summary: data.summary });
      handleOpenChange(false);
    } catch {
      setError('Unable to save call result.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Update Call Result</DialogTitle>
            <DialogDescription>
              Record what happened on this call attempt. History is never overwritten.
            </DialogDescription>
          </DialogHeader>

          {currentSummary?.doNotCall && !adminOverride ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              This record is marked Do Not Call. Contact an owner/admin to change status.
            </div>
          ) : null}

          {adminOverride ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Owner override active — you may update a Do Not Call record.
            </div>
          ) : null}

          {!selectedStatus ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700">Quick results</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {QUICK_CALL_RESULTS.map((status) => (
                  <Button
                    key={status}
                    type="button"
                    variant="outline"
                    className="h-14 justify-start text-base font-semibold"
                    onClick={() => pickStatus(status)}
                    disabled={currentSummary?.doNotCall && !adminOverride}
                  >
                    {CALL_STATUS_LABELS[status]}
                  </Button>
                ))}
              </div>
              {!showMore ? (
                <Button type="button" variant="ghost" onClick={() => setShowMore(true)}>
                  More Results
                </Button>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {MORE_CALL_RESULTS.map((status) => (
                    <Button
                      key={status}
                      type="button"
                      variant="outline"
                      className="h-12 justify-start"
                      onClick={() => pickStatus(status)}
                      disabled={currentSummary?.doNotCall && !adminOverride}
                    >
                      {CALL_STATUS_LABELS[status]}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-900">
                Selected: {CALL_STATUS_LABELS[selectedStatus]}
              </div>

              {requiresFollowUp(selectedStatus) ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Follow-up date</span>
                    <Input
                      type="date"
                      value={followUpDate}
                      onChange={(event) => setFollowUpDate(event.target.value)}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Follow-up time</span>
                    <Input
                      type="time"
                      value={followUpTime}
                      onChange={(event) => setFollowUpTime(event.target.value)}
                    />
                  </label>
                </div>
              ) : null}

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Note (optional)</span>
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  placeholder="Short note about the conversation…"
                />
              </label>

              {error ? <p className="text-sm text-rose-600">{error}</p> : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => saveResult(selectedStatus, Boolean(adminOverride))}
                  disabled={loading}
                >
                  {loading ? 'Saving…' : 'Save Result'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setSelectedStatus(null)}>
                  Back
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDoNotCall} onOpenChange={setConfirmDoNotCall}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Do Not Call?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disable future calling for this record until an owner/admin overrides it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDoNotCall(false);
                setSelectedStatus('DO_NOT_CALL');
              }}
            >
              Confirm Do Not Call
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
