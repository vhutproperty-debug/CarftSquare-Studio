'use client';

import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { whatsappUrl } from '@/lib/brand';
import BrandLogo from '@/components/BrandLogo';

export default function BlogSiteNav() {
  return (
    <nav className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/95 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between gap-3">
        <Link href="/" className="flex items-center">
          <BrandLogo variant="nav" />
        </Link>
        <div className="hidden items-center gap-5 text-sm font-semibold text-slate-300 md:flex">
          <Link href="/#services" className="hover:text-white">Services</Link>
          <Link href="/about" className="hover:text-white">About</Link>
          <Link href="/gallery" className="hover:text-white">Gallery</Link>
          <Link href="/blog" className="text-white">Blog</Link>
          <Link href="/rental-interiors" className="hover:text-white">Rental Interiors</Link>
        </div>
        <a href={whatsappUrl} target="_blank" rel="noreferrer">
          <Button className="bg-emerald-600 font-bold text-white hover:bg-emerald-700 rounded-full">
            <MessageCircle className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">WhatsApp</span>
          </Button>
        </a>
      </div>
    </nav>
  );
}
