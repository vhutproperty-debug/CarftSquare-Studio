'use client';

import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { META_LANDING_WHATSAPP } from '@/lib/meta-landing/content';

const WHATSAPP_SELECTOR = 'a[href*="wa.me"], a[href*="whatsapp.com"], a[href*="api.whatsapp.com"]';

function isElementVisible(el) {
  if (!(el instanceof HTMLElement)) return false;
  if (el.closest('[data-meta-floating-whatsapp]')) return false;

  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
    return false;
  }

  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;

  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;

  return rect.bottom > 0 && rect.right > 0 && rect.top < viewportHeight && rect.left < viewportWidth;
}

function hasVisibleWhatsAppCta() {
  if (typeof document === 'undefined') return false;
  return Array.from(document.querySelectorAll(WHATSAPP_SELECTOR)).some(isElementVisible);
}

export default function MetaFloatingWhatsApp() {
  const [showFloat, setShowFloat] = useState(false);

  useEffect(() => {
    let frame = 0;

    function evaluate() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setShowFloat(!hasVisibleWhatsAppCta());
      });
    }

    evaluate();

    window.addEventListener('scroll', evaluate, { passive: true });
    window.addEventListener('resize', evaluate);

    const observer = new MutationObserver(evaluate);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', evaluate);
      window.removeEventListener('resize', evaluate);
      observer.disconnect();
    };
  }, []);

  if (!showFloat) return null;

  return (
    <a
      href={META_LANDING_WHATSAPP}
      target="_blank"
      rel="noreferrer"
      data-meta-floating-whatsapp
      aria-label="Chat on WhatsApp"
      className="meta-floating-whatsapp fixed bottom-5 right-5 z-50 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-emerald-600 text-white shadow-[0_8px_28px_rgba(5,150,105,0.45)] transition-transform duration-200 hover:scale-105 hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 md:bottom-6 md:right-6 md:h-[3.75rem] md:w-[3.75rem]"
    >
      <MessageCircle className="h-6 w-6 md:h-7 md:w-7" aria-hidden="true" />
    </a>
  );
}
