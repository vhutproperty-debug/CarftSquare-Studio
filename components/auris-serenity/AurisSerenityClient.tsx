'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import AurisHeroImage from '@/components/auris-serenity/AurisHeroImage';
import AurisLeadBot, { useAurisBotAutoOpen } from '@/components/auris-serenity/AurisLeadBot';
import AurisStickyWhatsApp from '@/components/auris-serenity/AurisStickyWhatsApp';
import { trackAurisPageView } from '@/lib/auris-serenity/analytics';
import { AURIS_BOT_DISMISSED_KEY } from '@/lib/auris-serenity/constants';

type AurisSerenityClientProps = {
  hasTowerImage: boolean;
};

export default function AurisSerenityClient({ hasTowerImage }: AurisSerenityClientProps) {
  const [botOpen, setBotOpen] = useState(false);
  const [showReopenButton, setShowReopenButton] = useState(false);

  const openBot = useCallback(() => {
    setBotOpen(true);
    setShowReopenButton(false);
  }, []);

  const handleDismiss = useCallback(() => {
    setShowReopenButton(true);
  }, []);

  useAurisBotAutoOpen(openBot);

  useEffect(() => {
    trackAurisPageView();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(AURIS_BOT_DISMISSED_KEY)) {
      setShowReopenButton(true);
    }
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

      <section className="relative min-h-[92vh] overflow-hidden">
        <AurisHeroImage hasTowerImage={hasTowerImage} />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/30" />

        <div className="container relative z-10 flex min-h-[92vh] flex-col justify-end pb-28 pt-24 md:justify-center md:pb-20 md:pt-20">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-orange-300/90">
              CraftSquare Studio
            </p>
            <p className="mt-3 text-sm font-semibold text-slate-300">
              Interior &amp; Rental-Ready Solutions for Auris Serenity Homeowners
            </p>
            <h1
              className="mt-5 text-4xl font-black leading-[1.08] text-white md:text-5xl lg:text-6xl"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              Your Auris Serenity Home.
              <br />
              What&apos;s Your Plan?
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 md:text-lg">
              From preparing your apartment for rental to complete home furnishing, choose what you
              need.
            </p>
            <p className="mt-3 max-w-lg text-sm text-slate-400">
              One team for everything your Auris Serenity apartment needs after possession.
            </p>
            <Button
              type="button"
              onClick={openBot}
              className="mt-8 h-14 rounded-full bg-orange-600 px-8 text-base font-black text-white hover:bg-orange-500"
            >
              Choose Your Requirement
              <ChevronDown className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      <AurisLeadBot open={botOpen} onOpenChange={setBotOpen} onDismiss={handleDismiss} />

      {showReopenButton && !botOpen ? (
        <button
          type="button"
          onClick={openBot}
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-1/2 z-40 -translate-x-1/2 rounded-full border border-white/20 bg-slate-900/95 px-5 py-3 text-sm font-bold text-white shadow-lg backdrop-blur-md transition hover:bg-slate-800 md:bottom-8"
        >
          What&apos;s Your Plan?
        </button>
      ) : null}

      <AurisStickyWhatsApp />
    </div>
  );
}
