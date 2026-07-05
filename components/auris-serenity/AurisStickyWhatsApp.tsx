'use client';

import { MessageCircle } from 'lucide-react';
import { AURIS_WHATSAPP_URL } from '@/lib/auris-serenity/constants';
import { trackAurisWhatsAppClicked } from '@/lib/auris-serenity/analytics';

export default function AurisStickyWhatsApp() {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/95 backdrop-blur-md md:hidden"
      role="navigation"
      aria-label="WhatsApp contact"
    >
      <div className="px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        <a
          href={AURIS_WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackAurisWhatsAppClicked('general', 'sticky_bar')}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-600 text-sm font-bold text-white transition hover:bg-emerald-500"
        >
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
          WhatsApp Us
        </a>
      </div>
    </div>
  );
}
