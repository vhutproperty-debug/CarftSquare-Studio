'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BRAND, whatsappUrl } from '@/lib/brand';
import BrandLogo from '@/components/BrandLogo';
import GalleryViewer from '@/components/GalleryViewer';

function SiteNav() {
  return (
    <nav className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/95 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between gap-3">
        <Link href="/" className="flex items-center">
          <BrandLogo variant="nav" />
        </Link>
        <div className="hidden items-center gap-5 text-sm font-semibold text-slate-300 md:flex">
          <Link href="/#services" className="hover:text-white">Services</Link>
          <Link href="/about" className="hover:text-white">About</Link>
          <Link href="/gallery" className="text-white">Gallery</Link>
          <Link href="/rental-interiors" className="hover:text-white">Rental Interiors</Link>
        </div>
        <a href={whatsappUrl} target="_blank" rel="noreferrer">
          <Button className="bg-emerald-600 font-bold text-white hover:bg-emerald-700 rounded-full"><MessageCircle className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">WhatsApp</span></Button>
        </a>
      </div>
    </nav>
  );
}

export default function GalleryPage() {
  const [data, setData] = useState({ items: [], categories: [] });

  useEffect(() => {
    fetch('/api/gallery').then((r) => r.json()).then(setData).catch(() => {});
  }, []);

  const projects = (data.items || []).map((item) => ({
    ...item,
    image: item.thumbnailUrl || item.imageUrl,
  }));

  return (
    <main className="min-h-screen bg-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <SiteNav />
      <GalleryViewer
        items={projects}
        categories={data.categories}
        featuredOnly={false}
        sectionId="gallery"
        eyebrow="Full Gallery"
        title="Our interior design portfolio"
        subtitle="Explore residential, commercial, rental, modular and renovation projects across Mumbai."
      />
      <footer className="bg-slate-50 py-8 text-center text-sm text-slate-500">
        <p>© 2025 {BRAND.name}</p>
        <Link href="/" className="mt-2 inline-block font-bold text-orange-600">Back to homepage</Link>
      </footer>
    </main>
  );
}
