'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, ChevronDown } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import MetaLandingGallery from '@/components/meta-landing/MetaLandingGallery';
import MetaGalleryImage from '@/components/meta-landing/MetaGalleryImage';
import OberoiLeadForm from '@/components/oberoi-elysian/OberoiLeadForm';
import OberoiFloatingWhatsApp from '@/components/oberoi-elysian/OberoiFloatingWhatsApp';
import {
  AI_PLANNER_POINTS,
  FAQ_ITEMS,
  HERO_EYEBROW,
  PLANNING_TIMELINE,
  RENTAL_PACKAGES,
  WHY_BEFORE_POSSESSION,
} from '@/lib/oberoi-elysian/content';
import '@/components/meta-landing/meta-landing.css';

function scrollToRef(ref) {
  ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function FaqItem({ item, open, onToggle }) {
  return (
    <div className="meta-premium-card overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="font-bold text-[#FAF8F5]">{item.q}</span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-orange-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="border-t border-white/5 px-5 py-4 text-sm leading-7 text-slate-400">{item.a}</p>}
    </div>
  );
}

export default function OberoiElysianClient({ galleryItems = [], heroImage = null }) {
  const formRef = useRef(null);
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <div className="meta-landing-page min-h-screen text-[#FAF8F5]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0F0F10]/90 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <Link
            href="/"
            className="inline-flex cursor-pointer rounded-lg transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
            aria-label="CraftSquare Studio — Back to homepage"
          >
            <BrandLogo variant="nav" />
          </Link>
          <Button
            type="button"
            onClick={() => scrollToRef(formRef)}
            className="meta-cta-primary hidden rounded-full bg-orange-600 px-5 font-bold text-white hover:bg-orange-500 sm:inline-flex"
          >
            Reserve Consultation
          </Button>
        </div>
      </header>

      <section className="relative min-h-[88vh] overflow-hidden bg-[#0F0F10]">
        {heroImage ? (
          <div className="absolute inset-0">
            <MetaGalleryImage
              src={heroImage}
              alt="Premium rental-ready interior by CraftSquare Studio"
              fill
              priority
              className="object-cover"
              sizes="100vw"
            />
          </div>
        ) : null}
        <div className="meta-hero-overlay absolute inset-0" />
        <div className="container relative z-10 flex min-h-[88vh] flex-col justify-center py-16 md:py-20">
          <div className="meta-hero-content max-w-4xl">
            <p className="text-sm font-bold tracking-wide text-orange-200/95">{HERO_EYEBROW}</p>
            <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-orange-300/80">
              Plan Early · Rent Faster · Maximize Rental Income
            </p>
            <h1
              className="mt-4 max-w-3xl text-4xl font-black leading-[1.1] text-[#FAF8F5] md:text-5xl lg:text-6xl"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              Getting Possession of Your Oberoi Elysian Home Next Year?
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200/95">
              Start planning your rental interiors today and be ready to lease immediately after possession with AI-powered interior planning from CraftSquare Studio.
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">
              If you are expecting possession in approximately 12 months, early planning helps you avoid delays and start earning rental income sooner.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                onClick={() => scrollToRef(formRef)}
                className="meta-cta-primary h-14 rounded-full bg-orange-600 px-8 text-base font-black text-white hover:bg-orange-500"
              >
                Get Free Rental Interior Estimate
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => scrollToRef(formRef)}
                className="meta-cta-secondary h-14 rounded-full border-white/25 bg-white/10 px-8 text-base font-black text-[#FAF8F5] backdrop-blur-sm hover:bg-white/15"
              >
                Book Free Consultation
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#121214] py-16 md:py-24">
        <div className="container max-w-5xl">
          <h2
            className="text-center text-3xl font-black text-[#FAF8F5] md:text-4xl"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            Why Start Before Possession?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-7 text-slate-400">
            Oberoi Elysian homeowners receiving possession next year can save months after handover by planning interiors now.
          </p>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WHY_BEFORE_POSSESSION.map((item) => (
              <li key={item.title} className="meta-premium-card rounded-2xl p-5">
                <Check className="h-5 w-5 text-orange-400" />
                <p className="mt-3 font-black text-[#FAF8F5]">{item.title}</p>
                <p className="mt-2 text-sm leading-7 text-slate-400">{item.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-y border-white/5 bg-[#0F0F10] py-16 md:py-24">
        <div className="container max-w-6xl">
          <h2
            className="text-center text-3xl font-black text-[#FAF8F5] md:text-4xl"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            Rental Interior Packages
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-sm text-slate-400">
            Tenant-ready packages designed for investors preparing Oberoi Elysian homes for rental listing.
          </p>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {RENTAL_PACKAGES.map((pkg) => (
              <article
                key={pkg.name}
                className={`meta-premium-card rounded-2xl p-6 ${pkg.featured ? 'ring-1 ring-orange-500/40' : ''}`}
              >
                {pkg.featured ? (
                  <p className="text-xs font-bold uppercase tracking-wider text-orange-400">Most Popular</p>
                ) : null}
                <h3 className="mt-2 text-xl font-black text-[#FAF8F5]">{pkg.name}</h3>
                <p className="mt-2 text-sm text-slate-400">{pkg.highlight}</p>
                <ul className="mt-5 space-y-2">
                  {pkg.includes.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-slate-300">
                      <Check className="h-4 w-4 shrink-0 text-orange-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#121214] py-16 md:py-24">
        <div className="container max-w-4xl">
          <h2
            className="text-center text-3xl font-black text-[#FAF8F5] md:text-4xl"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            AI Rental Planner
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-7 text-slate-400">
            Our AI helps Oberoi Elysian homeowners estimate key rental furnishing decisions before possession.
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {AI_PLANNER_POINTS.map((point) => (
              <li key={point} className="meta-glass-panel flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-slate-200">
                <Check className="h-4 w-4 shrink-0 text-orange-400" />
                {point}
              </li>
            ))}
          </ul>
          <div className="mt-8 text-center">
            <Button
              type="button"
              onClick={() => scrollToRef(formRef)}
              className="meta-cta-primary h-14 rounded-full bg-orange-600 px-10 font-black text-white hover:bg-orange-500"
            >
              Start AI Rental Planning
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      <MetaLandingGallery items={galleryItems} />

      <section className="bg-[#121214] py-16 md:py-24">
        <div className="container max-w-4xl">
          <h2
            className="text-center text-3xl font-black text-[#FAF8F5] md:text-4xl"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            Early Planning Timeline
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-sm text-slate-400">
            A practical roadmap for homeowners expecting possession in ~12 months.
          </p>
          <ol className="relative mt-10 space-y-6 border-l border-orange-500/30 pl-8">
            {PLANNING_TIMELINE.map((step) => (
              <li key={step.month} className="meta-premium-card rounded-2xl p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-orange-400">{step.month}</p>
                <p className="mt-1 text-lg font-black text-[#FAF8F5]">{step.title}</p>
                <p className="mt-2 text-sm leading-7 text-slate-400">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="consultation" ref={formRef} className="scroll-mt-20 bg-[#0F0F10] py-16 md:py-24">
        <div className="container max-w-3xl">
          <h2
            className="text-center text-3xl font-black text-[#FAF8F5] md:text-4xl"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            Reserve Your Free Rental Interior Consultation
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-7 text-slate-400">
            Share your configuration and possession timeline. Our team will prepare a rental interior plan tailored to Oberoi Elysian.
          </p>
          <div className="mt-8">
            <OberoiLeadForm />
          </div>
        </div>
      </section>

      <section className="bg-[#121214] py-16 md:py-24">
        <div className="container max-w-3xl">
          <h2
            className="text-center text-3xl font-black text-[#FAF8F5] md:text-4xl"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            FAQ
          </h2>
          <div className="mt-8 space-y-3">
            {FAQ_ITEMS.map((item, index) => (
              <FaqItem
                key={item.q}
                item={item}
                open={openFaq === index}
                onToggle={() => setOpenFaq(openFaq === index ? -1 : index)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-br from-[#0F0F10] via-[#121214] to-[#0F0F10] py-20">
        <div className="container max-w-3xl text-center">
          <h2
            className="text-3xl font-black text-[#FAF8F5] md:text-4xl"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            Your Keys May Arrive Next Year.
            <span className="mt-2 block text-orange-300">Your Rental Income Planning Can Start Today.</span>
          </h2>
          <Button
            type="button"
            onClick={() => scrollToRef(formRef)}
            className="meta-cta-primary mt-8 h-14 rounded-full bg-orange-600 px-10 text-base font-black text-white hover:bg-orange-500"
          >
            Get Free Rental Estimate
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#0F0F10] py-8">
        <div className="container flex flex-col items-center justify-between gap-4 text-sm text-slate-500 sm:flex-row">
          <p>© {new Date().getFullYear()} CraftSquare Studio</p>
          <a href="/privacy-policy" className="font-semibold text-slate-400 transition hover:text-orange-400">
            Privacy Policy
          </a>
        </div>
      </footer>

      <OberoiFloatingWhatsApp />
    </div>
  );
}
