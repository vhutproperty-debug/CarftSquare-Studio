'use client';

import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { whatsappUrl } from '@/lib/brand';
import BrandLogo from '@/components/BrandLogo';

export default function Navbar({ onQuote }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const navLinks = [
    { label: 'AI Estimate', href: '/estimate' },
    { label: 'Services', href: '#services' },
    { label: 'About', href: '#about' },
    { label: 'Interiors', href: '#interiors' },
    { label: 'Modular Kitchen', href: '#modular-kitchen' },
    { label: 'Wardrobes', href: '#wardrobes' },
    { label: 'Projects', href: '#projects' },
  ];

  return (
    <>
      <nav className={`fixed left-0 right-0 top-0 z-40 transition-all duration-300 ${scrolled ? 'border-b border-white/10 bg-slate-950/95 backdrop-blur-xl shadow-lg' : 'bg-slate-950/80 backdrop-blur-xl'}`}>
        <div className="container flex h-16 items-center justify-between gap-3">
          <a href="#" className="flex items-center">
            <BrandLogo variant="nav" />
          </a>
          <div className="hidden items-center gap-5 text-sm font-semibold text-slate-300 lg:flex">
            {navLinks.map((link) => (
              <a key={link.label} href={link.href} className="hover:text-white transition-colors">{link.label}</a>
            ))}
            <a href="/gallery" className="hover:text-white transition-colors">Gallery</a>
            <a href="/rental-interiors" className="hover:text-white transition-colors">Rental Furnishing</a>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/estimate"
              className="hidden rounded-full bg-orange-600 px-5 py-2 text-sm font-black text-white hover:bg-orange-700 transition-colors sm:block"
            >
              AI Consultation
            </a>
            <a href={whatsappUrl} target="_blank" rel="noreferrer">
              <Button className="bg-emerald-600 px-3 font-bold text-white hover:bg-emerald-700 rounded-full sm:px-4">
                <MessageCircle className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">WhatsApp</span>
              </Button>
            </a>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white lg:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              <span className="text-lg">{mobileOpen ? '×' : '☰'}</span>
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="border-t border-white/10 bg-slate-950/98 px-4 pb-4 lg:hidden">
            {navLinks.map((link) => (
              <a key={link.label} href={link.href} className="block py-3 text-sm font-semibold text-slate-300 hover:text-white" onClick={() => setMobileOpen(false)}>
                {link.label}
              </a>
            ))}
            <a href="/gallery" className="block py-3 text-sm font-semibold text-slate-300 hover:text-white" onClick={() => setMobileOpen(false)}>Gallery</a>
            <a href="/rental-interiors" className="block py-3 text-sm font-semibold text-slate-300 hover:text-white" onClick={() => setMobileOpen(false)}>Rental Furnishing</a>
          </div>
        )}
      </nav>
    </>
  );
}
