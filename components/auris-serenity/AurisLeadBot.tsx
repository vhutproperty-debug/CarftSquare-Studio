'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Check, Loader2, MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

type BotStep = 1 | 2 | 3;

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
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetFlow = useCallback(() => {
    setStep(1);
    setSelectedIntent('');
    setPossessionTimeline('');
    setName('');
    setMobile('');
    setError('');
    setSubmitting(false);
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

  function selectPossession(timelineId: AurisPossessionId) {
    setPossessionTimeline(timelineId);
    setStep(3);
  }

  function goBack() {
    setError('');
    if (step === 3) {
      setStep(2);
      return;
    }
    if (step === 2) {
      setStep(1);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    const trimmedName = name.trim();
    const digits = mobile.replace(/\D/g, '').slice(-10);

    if (!selectedIntent || !possessionTimeline) {
      setError('Please complete all steps.');
      return;
    }
    if (trimmedName.length < 2) {
      setError('Please enter your name.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setSubmitting(true);

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
          name: trimmedName,
          mobile: digits,
          selectedIntent,
          possessionTimeline,
          pagePath,
          referrer,
          utm,
          source: AURIS_LEAD_SOURCE,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Could not submit your request.');
      }

      trackAurisLeadSubmitted(selectedIntent, possessionTimeline);
      trackAurisMetaLead(trimmedName, digits, selectedIntent);

      const whatsappUrl = buildAurisWhatsAppUrl({
        name: trimmedName,
        selectedIntent,
        possessionTimeline,
      });

      trackAurisWhatsAppClicked(selectedIntent, 'lead_bot_submit');
      window.location.href = whatsappUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
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
                {step > 1 && (
                  <button
                    type="button"
                    onClick={goBack}
                    className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </button>
                )}
                <Drawer.Title className="text-xl font-black text-slate-950">
                  {step === 1 && 'What are you planning for your Auris Serenity apartment?'}
                  {step === 2 && 'When do you expect possession?'}
                  {step === 3 && 'Almost there — just your details'}
                </Drawer.Title>
                <Drawer.Description id="auris-bot-description" className="mt-1 text-sm text-slate-500">
                  {step === 1 && 'Choose one option to get a tailored plan on WhatsApp.'}
                  {step === 2 && 'This helps us recommend the right timeline and scope.'}
                  {step === 3 && 'We will open WhatsApp with your requirement pre-filled.'}
                </Drawer.Description>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
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
            <div className="grid grid-cols-2 gap-3">
              {AURIS_POSSESSION_OPTIONS.map((option) => {
                const selected = possessionTimeline === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => selectPossession(option.id)}
                    className={`rounded-2xl border-2 px-4 py-4 text-left text-sm font-bold transition ${
                      selected
                        ? 'border-orange-500 bg-orange-50 text-slate-900'
                        : 'border-slate-200 bg-white text-slate-800 hover:border-orange-300'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}

          {step === 3 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="auris-name" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Name
                </label>
                <Input
                  id="auris-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your full name"
                  className="h-12 rounded-xl text-base"
                  required
                />
              </div>
              <div>
                <label htmlFor="auris-mobile" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Mobile Number
                </label>
                <Input
                  id="auris-mobile"
                  name="mobile"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={mobile}
                  onChange={(event) => setMobile(event.target.value)}
                  placeholder="10-digit mobile number"
                  className="h-12 rounded-xl text-base"
                  required
                />
              </div>
              {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
              <Button
                type="submit"
                disabled={submitting}
                className="h-13 w-full rounded-full bg-emerald-600 text-base font-black text-white hover:bg-emerald-500"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Opening WhatsApp…
                  </>
                ) : (
                  <>
                    <MessageCircle className="mr-2 h-5 w-5" />
                    Get My Plan on WhatsApp
                  </>
                )}
              </Button>
            </form>
          )}
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
