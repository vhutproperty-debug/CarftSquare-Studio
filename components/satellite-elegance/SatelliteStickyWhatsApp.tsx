'use client';

import { MessageCircle } from 'lucide-react';
import { SATELLITE_WHATSAPP_URL } from '@/lib/satellite-elegance/constants';
import { trackSatelliteWhatsAppClicked } from '@/lib/satellite-elegance/analytics';

type SatelliteStickyWhatsAppProps = {
  hidden?: boolean;
};

export default function SatelliteStickyWhatsApp({ hidden = false }: SatelliteStickyWhatsAppProps) {
  if (hidden) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-20 border-t border-white/5 bg-slate-950/80 backdrop-blur-sm md:hidden"
      role="navigation"
      aria-label="WhatsApp contact"
    >
      <div className="px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <a
          href={SATELLITE_WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackSatelliteWhatsAppClicked('general', 'sticky_bar')}
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-full border border-white/15 bg-transparent text-xs font-semibold text-slate-400 transition hover:border-emerald-500/40 hover:text-emerald-400"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          Chat on WhatsApp
        </a>
      </div>
    </div>
  );
}
