'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Check, Loader2, X } from 'lucide-react';
import { Drawer } from 'vaul';
import {
  trackAurisIntentSelected,
  trackAurisLeadSubmitted,
  trackAurisMetaLead,
  trackAurisWhatsAppClicked,
} from '@/lib/auris-serenity/analytics';
import {
  AURIS_BOT_DISMISSED_KEY,
  AURIS_INTENTS,
  AURIS_LANDING_PATH,
  AURIS_LEAD_SOURCE,
  AURIS_POSSESSION_OPTIONS,
  type AurisIntentId,
  type AurisPossessionId,
} from '@/lib/auris-serenity/constants';
import { captureUtmFromWindow } from '@/lib/auris-serenity/utm';
import { buildAurisWhatsAppUrl } from '@/lib/auris-serenity/whatsapp';

type BotStep = 1 | 2;

type AurisLeadBotProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDismiss: () => void;
};

function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 767px)').matches;
}

export default function AurisLeadBot({ open, onOpenChange, onDismiss }: AurisLeadBotProps) {
  const [step, setStep] = useState<BotStep>(1);
  const [selectedIntent, setSelectedIntent] = useState<AurisIntentId | ''>('');
  const [possessionTimeline, setPossessionTimeline] = useState<AurisPossessionId | ''>('');
  const [continuing, setContinuing] = useState(false);
  const [error, setError] = useState('');

  const resetFlow = useCallback(() => {
    setStep(1);
    setSelectedIntent('');
    setPossessionTimeline('');
    setContinuing(false);
    setError('');
  }, []);

  useEffect(() => {
    if (!open) return;
    resetFlow();
  }, [open, resetFlow]);

  function handleClose() {
    onOpenChange(false);
    onDismiss();
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(AURIS_BOT_DISMISSED_KEY, '1');
    }
  }

  function selectIntent(intentId: AurisIntentId) {
    setSelectedIntent(intentId);
    trackAurisIntentSelected(intentId);
    setStep(2);
  }

  function goBack() {
    setError('');
    setContinuing(false);
    setPossessionTimeline('');
    setStep(1);
  }

  async function continueOnWhatsApp(timelineId: AurisPossessionId) {
    if (!selectedIntent || continuing) return;

    setPossessionTimeline(timelineId);
    setContinuing(true);
    setError('');

    const utm = captureUtmFromWindow();
    const pagePath = typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : AURIS_LANDING_PATH;
    const referrer = typeof document !== 'undefined' ? document.referrer || '' : '';

    try {
      const res = await fetch('/api/auris-serenity/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedIntent,
          possessionTimeline: timelineId,
          pagePath,
          referrer,
          utm,
          source: AURIS_LEAD_SOURCE,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Could not continue to WhatsApp.');
      }

      trackAurisLeadSubmitted(selectedIntent, timelineId);
      trackAurisMetaLead(selectedIntent, timelineId);

      const whatsappUrl = buildAurisWhatsAppUrl({
        selectedIntent,
        possessionTimeline: timelineId,
      });

      trackAurisWhatsAppClicked(selectedIntent, 'lead_bot_continue');
      window.location.href = whatsappUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setContinuing(false);
    }
  }

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleClose();
        else onOpenChange(true);
      }}
      shouldScaleBackground={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-slate-950/45" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85vh] flex-col rounded-t-3xl border border-slate-200 bg-white pb-[max(1rem,env(safe-area-inset-bottom))] outline-none md:max-w-lg"
          aria-describedby="auris-bot-description"
        >
          <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-slate-200" />

          <div className="relative px-5 pb-2 pt-4 text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {step === 2 && (
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={continuing}
                    className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-50"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </button>
                )}
                <Drawer.Title className="text-xl font-black text-slate-950">
                  {step === 1 && 'What are you planning for your Auris Serenity apartment?'}
                  {step === 2 && 'When do you expect possession?'}
                </Drawer.Title>
                <Drawer.Description id="auris-bot-description" className="mt-1 text-sm text-slate-500">
                  {step === 1 && 'Choose one option to continue on WhatsApp.'}
                  {step === 2 && 'Select your timeline — we\'ll open WhatsApp with your requirement pre-filled.'}
                </Drawer.Description>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={continuing}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto px-5 pb-4">
            {step === 1 && (
              <div className="space-y-3">
                {AURIS_INTENTS.map((intent) => {
                  const selected = selectedIntent === intent.id;
                  return (
                    <button
                      key={intent.id}
                      type="button"
                      onClick={() => selectIntent(intent.id)}
                      className={`w-full rounded-2xl border-2 p-4 text-left transition ${
                        selected
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-slate-200 bg-white hover:border-orange-300 hover:bg-orange-50/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black uppercase tracking-wide text-orange-600">
                            {intent.label}
                          </p>
                          <p className="mt-1 text-base font-semibold text-slate-900">{intent.subtext}</p>
                        </div>
                        {selected ? <Check className="h-5 w-5 shrink-0 text-orange-600" /> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {AURIS_POSSESSION_OPTIONS.map((option) => {
                    const selected = possessionTimeline === option.id;
                    const isLoading = continuing && selected;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={continuing}
                        onClick={() => continueOnWhatsApp(option.id)}
                        className={`rounded-2xl border-2 px-4 py-4 text-left text-sm font-bold transition disabled:opacity-70 ${
                          selected
                            ? 'border-orange-500 bg-orange-50 text-slate-900'
                            : 'border-slate-200 bg-white text-slate-800 hover:border-orange-300'
                        }`}
                      >
                        {isLoading ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Opening WhatsApp…
                          </span>
                        ) : (
                          option.label
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-center text-xs text-slate-500">
                  Tap a timeline to continue on WhatsApp
                </p>
              </div>
            )}

            {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export function useAurisBotAutoOpen(onOpen: () => void): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(AURIS_BOT_DISMISSED_KEY)) return;
    if (!isMobileViewport()) return;

    const timer = window.setTimeout(() => {
      if (sessionStorage.getItem(AURIS_BOT_DISMISSED_KEY)) return;
      onOpen();
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [onOpen]);
}
