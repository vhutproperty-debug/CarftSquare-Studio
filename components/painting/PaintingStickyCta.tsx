'use client';

import { Calendar, MessageCircle, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PAINTING_PHONE, PAINTING_WHATSAPP_URL } from '@/lib/painting/constants';
import { trackPaintingCallClick, trackPaintingWhatsAppClick } from '@/components/painting/PaintingAnalytics';

type PaintingStickyCtaProps = {
  onBookInspection: () => void;
};

export default function PaintingStickyCta({ onBookInspection }: PaintingStickyCtaProps) {
  return (
    <div
      className="painting-sticky-bar fixed inset-x-0 bottom-0 z-50 border-t border-black/5 bg-white/95 backdrop-blur-md md:hidden"
      role="navigation"
      aria-label="Quick contact actions"
    >
      <div className="flex items-center gap-2 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        <a
          href={`tel:${PAINTING_PHONE}`}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          onClick={() => trackPaintingCallClick('sticky_bar')}
        >
          <Phone className="h-5 w-5 text-orange-600" aria-hidden="true" />
          Call
        </a>
        <a
          href={PAINTING_WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          onClick={() => trackPaintingWhatsAppClick('sticky_bar')}
        >
          <MessageCircle className="h-5 w-5 text-emerald-600" aria-hidden="true" />
          WhatsApp
        </a>
        <Button
          type="button"
          onClick={onBookInspection}
          className="painting-cta-primary h-11 flex-[1.4] gap-1.5 text-sm"
        >
          <Calendar className="h-4 w-4" aria-hidden="true" />
          Book Inspection
        </Button>
      </div>
    </div>
  );
}
