'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BRAND, whatsappUrl } from '@/lib/brand';
import BrandLogo from '@/components/BrandLogo';

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
          <Link href="/#services" className="hover:text-white transition-colors">Services</Link>
          <Link href="/about" className="hover:text-white transition-colors">About</Link>
          <Link href="/gallery" className="hover:text-white transition-colors">Gallery</Link>
          <Link href="/rental-interiors" className="hover:text-white transition-colors">Rental Interiors</Link>
        </div>
        <a href={whatsappUrl} target="_blank" rel="noreferrer">
          <Button className="bg-emerald-600 font-bold text-white hover:bg-emerald-700 rounded-full"><MessageCircle className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">WhatsApp</span></Button>
        </a>
      </div>
    </nav>
  );
}

function SiteFooter() {
  return (
    <footer className="bg-white py-12 border-t border-slate-100">
      <div className="container text-center text-sm text-slate-500">
        <p>© 2025 {BRAND.name}. Premium interior design & solutions in Mumbai.</p>
        <Link href="/" className="mt-2 inline-block font-bold text-orange-600 hover:text-orange-700">Back to homepage</Link>
      </div>
    </footer>
  );
}

export default function AboutPage() {
  const [about, setAbout] = useState(null);

  useEffect(() => {
    fetch('/api/about').then((r) => r.json()).then((d) => setAbout(d.about)).catch(() => {});
  }, []);

  if (!about) {
    return (
      <main className="min-h-screen bg-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <SiteNav />
        <div className="container py-24 text-center text-slate-500">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-slate-950" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <SiteNav />
      <section className="py-24">
        <div className="container">
          <SectionHeader eyebrow="About Us" title={`About ${BRAND.name}`} text={about.companyIntroduction} />

          {about.images?.length > 0 && (
            <div className="mb-12 grid gap-4 md:grid-cols-3">
              {about.images.map((img, i) => (
                <div key={img.url || i} className="overflow-hidden rounded-3xl shadow-lg">
                  <img src={img.url} alt={img.alt || ''} loading="lazy" className="h-64 w-full object-cover" />
                </div>
              ))}
            </div>
          )}

          <div className="mx-auto max-w-4xl space-y-10">
            {about.founderMessage && (
              <Card className="border-orange-100">
                <CardContent className="p-8">
                  <Badge className="mb-4 bg-orange-100 text-orange-700 hover:bg-orange-100">Founder&apos;s Message</Badge>
                  <p className="text-lg leading-8 text-slate-600 italic">&ldquo;{about.founderMessage}&rdquo;</p>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              {about.mission && (
                <Card><CardContent className="p-6"><p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">Mission</p><p className="mt-3 leading-7 text-slate-600">{about.mission}</p></CardContent></Card>
              )}
              {about.vision && (
                <Card><CardContent className="p-6"><p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">Vision</p><p className="mt-3 leading-7 text-slate-600">{about.vision}</p></CardContent></Card>
              )}
            </div>

            {about.coreValues?.length > 0 && (
              <div>
                <h2 className="mb-6 text-2xl font-black" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Core Values</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {about.coreValues.map((v) => (
                    <Card key={v.title}><CardContent className="p-5"><h3 className="font-black">{v.title}</h3><p className="mt-2 text-sm text-slate-600">{v.text}</p></CardContent></Card>
                  ))}
                </div>
              </div>
            )}

            {about.whyChooseUs?.length > 0 && (
              <div>
                <h2 className="mb-6 text-2xl font-black" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Why Choose Us</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {about.whyChooseUs.map((v) => (
                    <Card key={v.title}><CardContent className="p-5"><h3 className="font-black">{v.title}</h3><p className="mt-2 text-sm text-slate-600">{v.text}</p></CardContent></Card>
                  ))}
                </div>
              </div>
            )}

            {about.teamDescription && (
              <Card><CardContent className="p-8">
                <h2 className="text-2xl font-black mb-3" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Our Team · {about.experienceYears} Experience</h2>
                <p className="leading-7 text-slate-600">{about.teamDescription}</p>
              </CardContent></Card>
            )}

            {about.certifications?.length > 0 && (
              <div>
                <h2 className="mb-6 text-2xl font-black" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Certifications</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {about.certifications.map((c) => (
                    <Card key={c.name}><CardContent className="p-5"><h3 className="font-black">{c.name}</h3><p className="mt-2 text-sm text-slate-600">{c.description}</p></CardContent></Card>
                  ))}
                </div>
              </div>
            )}

            <div className="text-center pt-6">
              <Link href="/#quote"><Button className="bg-orange-600 font-black text-white hover:bg-orange-700 rounded-full px-8">Book Free Consultation <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
            </div>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
