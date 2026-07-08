'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Loader2, X } from 'lucide-react';
import { Drawer } from 'vaul';
import {
  trackSatelliteLeadSubmitted,
  trackSatelliteMetaLead,
  trackSatelliteWhatsAppClicked,
} from '@/lib/satellite-elegance/analytics';
import {
  SATELLITE_BOT_DISMISSED_KEY,
  SATELLITE_LANDING_PATH,
  SATELLITE_LEAD_SOURCE,
  SATELLITE_POSSESSION_OPTIONS,
  type SatelliteIntentId,
  type SatellitePossessionId,
} from '@/lib/satellite-elegance/constants';
import { captureUtmFromWindow } from '@/lib/satellite-elegance/utm';
import { buildSatelliteWhatsAppUrl } from '@/lib/satellite-elegance/whatsapp';

type BotStep = 1 | 2;

type SatelliteLeadBotProps = {
  open: boolean;
  initialIntent?: SatelliteIntentId | '';
  onOpenChange: (open: boolean) => void;
  onDismiss: () => void;
};

export default function SatelliteLeadBot({
  open,
  initialIntent = '',
  onOpenChange,
  onDismiss,
}: SatelliteLeadBotProps) {
  const [step, setStep] = useState<BotStep>(1);
  const [selectedIntent, setSelectedIntent] = useState<SatelliteIntentId | ''>('');
  const [possessionTimeline, setPossessionTimeline] = useState<SatellitePossessionId | ''>('');
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

    if (initialIntent) {
      setSelectedIntent(initialIntent);
      setStep(2);
      setPossessionTimeline('');
      setContinuing(false);
      setError('');
      return;
    }

    resetFlow();
  }, [open, initialIntent, resetFlow]);

  function handleClose() {
    onOpenChange(false);
    onDismiss();
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(SATELLITE_BOT_DISMISSED_KEY, '1');
    }
  }

  function goBack() {
    setError('');
    setContinuing(false);
    setPossessionTimeline('');
    handleClose();
  }

  async function continueOnWhatsApp(timelineId: SatellitePossessionId) {
    if (!selectedIntent || continuing) return;

    setPossessionTimeline(timelineId);
    setContinuing(true);
    setError('');

    const utm = captureUtmFromWindow();
    const pagePath = typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : SATELLITE_LANDING_PATH;
    const referrer = typeof document !== 'undefined' ? document.referrer || '' : '';

    try {
      const res = await fetch('/api/satellite-elegance/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedIntent,
          possessionTimeline: timelineId,
          pagePath,
          referrer,
          utm,
          source: SATELLITE_LEAD_SOURCE,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Could not continue to WhatsApp.');
      }

      trackSatelliteLeadSubmitted(selectedIntent, timelineId);
      trackSatelliteMetaLead(selectedIntent, timelineId);

      const whatsappUrl = buildSatelliteWhatsAppUrl({
        selectedIntent,
        possessionTimeline: timelineId,
      });

      trackSatelliteWhatsAppClicked(selectedIntent, 'lead_bot_continue');
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
          aria-describedby="satellite-bot-description"
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
                  When do you expect possession?
                </Drawer.Title>
                <Drawer.Description id="satellite-bot-description" className="mt-1 text-sm text-slate-500">
                  Select your timeline — we&apos;ll open WhatsApp with your requirement pre-filled.
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
            {step === 2 && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {SATELLITE_POSSESSION_OPTIONS.map((option) => {
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
