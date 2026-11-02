'use client';

import { useState } from 'react';
import { CALL_OUTCOME_LABELS, CALL_OUTCOMES, type CallOutcome } from '@/lib/ops/contacts/types';

const TONE: Record<CallOutcome, string> = {
  interested: 'bg-emerald-600 text-white',
  callback: 'bg-sky-600 text-white',
  not_interested: 'bg-slate-700 text-white',
  wrong_number: 'bg-amber-600 text-white',
  dnd: 'bg-rose-600 text-white',
};

export default function OutcomeBar({ contactId, onDone }: { contactId: string; onDone: () => void }) {
  const [callbackOn, setCallbackOn] = useState('');
  const [showDate, setShowDate] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(outcome: CallOutcome) {
    if (outcome === 'callback' && !showDate) {
      setShowDate(true);
      return;
    }
    setBusy(true);
    setError('');
    const response = await fetch(`/api/ops/contacts/${contactId}/outcomes`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome, note, callbackOn: outcome === 'callback' ? callbackOn : undefined }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(body.error || 'Unable to save the outcome.');
      return;
    }
    setNote('');
    setCallbackOn('');
    setShowDate(false);
    onDone();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {CALL_OUTCOMES.map((outcome) => (
          <button
            key={outcome}
            type="button"
            disabled={busy}
            onClick={() => save(outcome)}
            className={`min-h-11 rounded-full px-3 py-2 text-sm font-semibold ${TONE[outcome]} disabled:opacity-60`}
          >
            {CALL_OUTCOME_LABELS[outcome]}
          </button>
        ))}
      </div>
      {showDate ? (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          Callback date
          <input type="date" value={callbackOn} onChange={(event) => setCallbackOn(event.target.value)} className="h-10 rounded-md border border-slate-200 px-2" />
          <button type="button" disabled={busy || !callbackOn} onClick={() => save('callback')} className="min-h-10 rounded-md bg-sky-600 px-3 text-sm font-semibold text-white disabled:opacity-60">
            Save callback
          </button>
        </label>
      ) : null}
      <input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Optional note"
        aria-label="Outcome note"
        className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
      />
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
