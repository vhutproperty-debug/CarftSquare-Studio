'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import SatelliteHeroImage from '@/components/satellite-elegance/SatelliteHeroImage';
import SatelliteLeadBot from '@/components/satellite-elegance/SatelliteLeadBot';
import SatelliteStickyWhatsApp from '@/components/satellite-elegance/SatelliteStickyWhatsApp';
import { trackSatelliteIntentSelected, trackSatellitePageView } from '@/lib/satellite-elegance/analytics';
import { SATELLITE_INTENTS, type SatelliteIntentId } from '@/lib/satellite-elegance/constants';

type SatelliteEleganceClientProps = {
  hasTowerImage: boolean;
};

export default function SatelliteEleganceClient({ hasTowerImage }: SatelliteEleganceClientProps) {
  const [botOpen, setBotOpen] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<SatelliteIntentId | ''>('');
  const [inIntentFlow, setInIntentFlow] = useState(false);

  const handleInlineIntentSelect = useCallback((intentId: SatelliteIntentId) => {
    trackSatelliteIntentSelected(intentId);
    setPendingIntent(intentId);
    setInIntentFlow(true);
    setBotOpen(true);
  }, []);

  const handleBotOpenChange = useCallback((open: boolean) => {
    setBotOpen(open);
    if (!open) {
      setPendingIntent('');
      setInIntentFlow(false);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setPendingIntent('');
  }, []);

  const scrollToChoices = useCallback(() => {
    document.getElementById('satellite-choices')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    trackSatellitePageView();
  }, []);

  return (
    <div
      className="min-h-screen bg-slate-950 text-white"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <header className="absolute left-0 right-0 top-0 z-30">
        <div className="container flex h-16 items-center justify-between">
          <BrandLogo variant="nav" className="" />
        </div>
      </header>

      <section className="relative min-h-[42vh] max-h-[50vh] overflow-hidden md:min-h-[48vh] md:max-h-[55vh]">
        <SatelliteHeroImage hasTowerImage={hasTowerImage} />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-950/35" />

        <div className="container relative z-10 flex h-full min-h-[42vh] flex-col justify-end pb-6 pt-20 md:min-h-[48vh] md:justify-end md:pb-8 md:pt-24">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-300/90 md:text-sm">
              Satellite Elegance Homeowners
            </p>
            <p className="mt-2 text-xs font-semibold text-slate-300 md:text-sm">
              Complete Home Interiors by CraftSquare Studio
            </p>
            <h1 className="mt-3 text-3xl font-semibold leading-[1.08] text-white [text-shadow:0_2px_16px_rgb(0_0_0/0.45)] md:text-4xl lg:text-5xl">
              Getting possession at Satellite Elegance?
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 md:text-base">
              Plan your complete home interiors before you move in.
            </p>
            <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-orange-300/90 md:text-base">
              Free Design Consultation + Site Visit + Measurement
            </p>
          </div>
        </div>
      </section>

      <section
        id="satellite-choices"
        className="relative z-10 bg-slate-950 px-4 pb-28 pt-2 md:pb-12"
      >
        <div className="container max-w-2xl">
          <h2 className="text-lg font-semibold text-white md:text-xl">
            What are you planning for your Satellite Elegance home?
          </h2>
          <div className="mt-4 space-y-3">
            {SATELLITE_INTENTS.map((intent) => (
              <button
                key={intent.id}
                type="button"
                onClick={() => handleInlineIntentSelect(intent.id)}
                className="group flex w-full items-center justify-between gap-3 rounded-2xl border-2 border-white/15 bg-white/5 p-4 text-left transition hover:border-orange-500/60 hover:bg-orange-500/10 active:scale-[0.99]"
              >
                <div className="min-w-0">
                  <p className="text-base font-semibold text-white md:text-lg">{intent.label}</p>
                  <p className="mt-0.5 text-sm font-normal text-slate-400">{intent.subtext}</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-orange-400 transition group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        </div>
      </section>

      <SatelliteLeadBot
        open={botOpen}
        initialIntent={pendingIntent}
        onOpenChange={handleBotOpenChange}
        onDismiss={handleDismiss}
      />

      {!botOpen ? (
        <button
          type="button"
          onClick={scrollToChoices}
          className="fixed bottom-[calc(3.25rem+env(safe-area-inset-bottom))] left-1/2 z-30 -translate-x-1/2 rounded-full border border-white/15 bg-slate-900/90 px-4 py-2 text-xs font-semibold text-slate-300 backdrop-blur-md transition hover:border-white/25 hover:text-white md:bottom-6"
        >
          Get Free Design Consultation
        </button>
      ) : null}

      <SatelliteStickyWhatsApp hidden={inIntentFlow || botOpen} />
    </div>
  );
}
