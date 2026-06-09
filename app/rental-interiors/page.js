'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Home, MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BRAND, whatsappUrl } from '@/lib/brand';
import BrandLogo from '@/components/BrandLogo';
import GalleryViewer from '@/components/GalleryViewer';

function SectionHeader({ eyebrow, title, text }) {
  return (
    <div className="mx-auto mb-10 max-w-3xl text-center">
      <Badge className="mb-4 bg-orange-100 text-orange-700 hover:bg-orange-100">{eyebrow}</Badge>
      <h1 className="text-3xl font-black tracking-tight text-slate-950 md:text-5xl" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{title}</h1>
      {text && <p className="mt-4 text-base leading-7 text-slate-600 md:text-lg">{text}</p>}
    </div>
  );
}

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
          <Link href="/gallery" className="hover:text-white">Gallery</Link>
          <Link href="/rental-interiors" className="text-white">Rental Interiors</Link>
        </div>
        <a href={whatsappUrl} target="_blank" rel="noreferrer">
          <Button className="bg-emerald-600 font-bold text-white hover:bg-emerald-700 rounded-full"><MessageCircle className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">WhatsApp</span></Button>
        </a>
      </div>
    </nav>
  );
}

export default function RentalInteriorsPage() {
  const [data, setData] = useState({ service: null, subServices: [] });
  const [galleryItems, setGalleryItems] = useState([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/rental-interiors').then((r) => r.json()),
      fetch('/api/gallery?category=rental-interiors').then((r) => r.json()),
    ]).then(([rental, gallery]) => {
      setData(rental);
      setGalleryItems((gallery.items || []).map((item) => ({ ...item, image: item.thumbnailUrl || item.imageUrl })));
    }).catch(() => {});
  }, []);

  const service = data.service;

  return (
    <main className="min-h-screen bg-white text-slate-950" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <SiteNav />

      <section className="bg-slate-950 py-24 text-white">
        <div className="container grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <Badge className="mb-4 border border-orange-300/40 bg-white/10 text-orange-100 hover:bg-white/10">Rental Interiors</Badge>
            <h1 className="text-4xl font-black md:text-6xl" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{service?.name || 'Rental Interiors'}</h1>
            <p className="mt-6 text-lg leading-8 text-slate-300">{service?.description || service?.shortDescription}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/estimate"><Button className="bg-orange-600 font-black text-white hover:bg-orange-700 rounded-full">Get AI Furnishing Estimate <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
              <Link href="/#quote"><Button variant="outline" className="border-white/20 bg-white/10 font-black text-white hover:bg-white/20 rounded-full">Book Consultation</Button></Link>
              <a href={whatsappUrl} target="_blank" rel="noreferrer"><Button variant="outline" className="border-emerald-500/40 text-emerald-200 rounded-full">WhatsApp</Button></a>
            </div>
          </div>
          {service?.heroImage && (
            <div className="overflow-hidden rounded-3xl shadow-2xl">
              <img src={service.heroImage} alt={service.name} className="h-80 w-full object-cover lg:h-96" loading="lazy" />
            </div>
          )}
        </div>
      </section>

      <section className="py-24">
        <div className="container">
          <SectionHeader eyebrow="Sub-services" title="Complete rental interior solutions" text="Investor-ready packages designed for faster occupancy and higher rental yield." />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {(data.subServices || []).map((sub) => (
              <Card key={sub.id} className="group border-slate-100 transition duration-300 hover:-translate-y-2 hover:shadow-xl">
                <CardContent className="p-6">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
                    <Home className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-black">{sub.name}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{sub.description}</p>
                  <Link href="/#quote" className="mt-5 inline-flex items-center text-sm font-black text-slate-950">
                    Enquire <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {service?.features?.length > 0 && (
        <section className="bg-slate-50 py-16">
          <div className="container">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {service.features.map((f) => (
                <div key={f} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
                  <CheckCircle2 className="h-5 w-5 flex-none text-orange-600" />
                  <span className="text-sm font-bold">{f}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {galleryItems.length > 0 && (
        <GalleryViewer
          items={galleryItems}
          featuredOnly={false}
          sectionId="rental-gallery"
          eyebrow="Rental portfolio"
          title="Rental interior projects"
          subtitle="Furnished conversions, Airbnb setups and investor-ready rental apartments."
        />
      )}

      <footer className="py-12 text-center text-sm text-slate-500">
        <p>© 2025 {BRAND.name}</p>
        <Link href="/" className="mt-2 inline-block font-bold text-orange-600">Back to homepage</Link>
      </footer>
    </main>
  );
}
