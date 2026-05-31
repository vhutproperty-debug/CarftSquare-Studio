'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BRAND, whatsappUrl } from '@/lib/brand';
import BrandLogo from '@/components/BrandLogo';

function SiteNav() {
  return (
    <nav className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/95 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between gap-3">
        <Link href="/" className="flex items-center">
          <BrandLogo variant="nav" />
        </Link>
        <Link href="/#services"><Button variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20 rounded-full">All Services</Button></Link>
      </div>
    </nav>
  );
}

export default function ServicePage({ params }) {
  const [service, setService] = useState(null);
  const slug = params?.slug;

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/services/${slug}`).then((r) => r.json()).then((d) => setService(d.service)).catch(() => {});
  }, [slug]);

  if (!service) {
    return (
      <main className="min-h-screen bg-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <SiteNav />
        <div className="container py-24 text-center text-slate-500">{slug ? 'Loading...' : 'Service not found'}</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-slate-950" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <SiteNav />

      <section className="bg-slate-950 py-24 text-white">
        <div className="container grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <Badge className="mb-4 bg-orange-500 text-white hover:bg-orange-500">{service.priceLabel}</Badge>
            <h1 className="text-4xl font-black md:text-6xl" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{service.name}</h1>
            <p className="mt-6 text-lg leading-8 text-slate-300">{service.description || service.shortDescription}</p>
            <div className="mt-8 flex gap-3">
              <Link href="/#quote"><Button className="bg-orange-600 font-black text-white hover:bg-orange-700 rounded-full">Get Quote <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
              <a href={whatsappUrl} target="_blank" rel="noreferrer"><Button variant="outline" className="border-emerald-500/40 text-emerald-200 rounded-full"><MessageCircle className="mr-2 h-4 w-4" /> WhatsApp</Button></a>
            </div>
          </div>
          {service.heroImage && (
            <div className="overflow-hidden rounded-3xl shadow-2xl">
              <img src={service.heroImage} alt={service.name} className="h-80 w-full object-cover lg:h-96" loading="lazy" />
            </div>
          )}
        </div>
      </section>

      {service.features?.length > 0 && (
        <section className="py-24">
          <div className="container">
            <h2 className="mb-8 text-center text-3xl font-black" style={{ fontFamily: "'Cormorant Garamond', serif" }}>What&apos;s included</h2>
            <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
              {service.features.map((f) => (
                <div key={f} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-4">
                  <CheckCircle2 className="h-5 w-5 flex-none text-orange-600" />
                  <span className="font-bold">{f}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {service.galleryImages?.length > 0 && (
        <section className="bg-slate-50 py-24">
          <div className="container">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {service.galleryImages.map((url, i) => (
                <div key={url || i} className="overflow-hidden rounded-2xl shadow-lg">
                  <img src={url} alt="" loading="lazy" className="h-64 w-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className="py-12 text-center text-sm text-slate-500">
        <p>© 2025 {BRAND.name}</p>
        <Link href="/" className="mt-2 inline-block font-bold text-orange-600">Back to homepage</Link>
      </footer>
    </main>
  );
}
