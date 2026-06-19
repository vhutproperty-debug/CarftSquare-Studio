'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Star } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import MetaConsultationChat from '@/components/meta-landing/MetaConsultationChat';
import MetaFloatingWhatsApp from '@/components/meta-landing/MetaFloatingWhatsApp';
import MetaLandingGallery from '@/components/meta-landing/MetaLandingGallery';
import MetaGalleryImage from '@/components/meta-landing/MetaGalleryImage';
import {
  CHAT_SOCIAL_PROOF,
  FALLBACK_TESTIMONIALS,
  HERO_EYEBROW,
  PRIVACY_TEXT,
  SOCIAL_PROOF,
  TRUST_BADGES,
  WHY_CRAFTSQUARE,
} from '@/lib/meta-landing/content';
import './meta-landing.css';

function startConsultation(setChatActive, sectionRef) {
  setChatActive(true);
  window.setTimeout(() => {
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

function TestimonialCard({ review }) {
  return (
    <article className="meta-premium-card min-w-[280px] max-w-sm flex-none rounded-2xl p-6">
      <div className="flex gap-1 text-orange-400">
        {Array.from({ length: review.rating || 5 }).map((_, index) => (
          <Star key={index} className="h-4 w-4 fill-current" />
        ))}
      </div>
      <p className="mt-4 text-sm leading-7 text-slate-300">&ldquo;{review.reviewText}&rdquo;</p>
      <p className="mt-5 text-sm font-black text-[#FAF8F5]">{review.customerName}</p>
      <p className="text-xs font-semibold text-slate-500">
        {review.projectType}{review.area ? ` · ${review.area}` : ''}
      </p>
    </article>
  );
}

export default function MetaLandingClient({ reviews = [], galleryItems = [], heroImage = null }) {
  const [chatActive, setChatActive] = useState(false);
  const consultationRef = useRef(null);
  const testimonials = reviews.length ? reviews : FALLBACK_TESTIMONIALS;

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
            onClick={() => startConsultation(setChatActive, consultationRef)}
            className="meta-cta-primary hidden rounded-full bg-orange-600 px-5 font-bold text-white hover:bg-orange-500 sm:inline-flex"
          >
            Start AI Consultation
          </Button>
        </div>
      </header>

      <section className="relative min-h-[88vh] overflow-hidden bg-[#0F0F10]">
        {heroImage ? (
          <div className="absolute inset-0">
            <MetaGalleryImage
              src={heroImage}
              alt="Premium interior project by CraftSquare Studio"
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
            <h1
              className="mt-4 max-w-3xl text-4xl font-black leading-[1.1] text-[#FAF8F5] drop-shadow-sm md:text-6xl"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              Get Your Interior Budget in 60 Seconds
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200/95">
              Answer a few simple questions and receive a personalized interior estimate, design direction and expert recommendations for your Mumbai home.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                onClick={() => startConsultation(setChatActive, consultationRef)}
                className="meta-cta-primary h-14 rounded-full bg-orange-600 px-8 text-base font-black text-white hover:bg-orange-500"
              >
                Get Free AI Estimate
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => startConsultation(setChatActive, consultationRef)}
                className="meta-cta-secondary h-14 rounded-full border-white/25 bg-white/10 px-8 text-base font-black text-[#FAF8F5] backdrop-blur-sm hover:bg-white/15"
              >
                Book Free Consultation
              </Button>
            </div>
            <ul className="mt-10 grid max-w-3xl gap-3 sm:grid-cols-2">
              {TRUST_BADGES.map((badge) => (
                <li key={badge} className="flex items-center gap-2 text-sm font-semibold text-slate-100/95">
                  <Check className="h-4 w-4 shrink-0 text-orange-400" />
                  {badge}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="consultation" ref={consultationRef} className="scroll-mt-20 bg-[#121214] py-16 md:py-24">
        <div className="container max-w-3xl">
          <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-orange-400/90">AI Consultation</p>
          <h2
            className="mt-3 text-center text-3xl font-black text-[#FAF8F5] md:text-4xl"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            Talk to Your AI Interior Consultant
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-base leading-7 text-slate-400">
            Our AI consultant will guide you step-by-step — takes less than 60 seconds.
          </p>

          <div className="meta-glass-panel mt-8 rounded-2xl p-5 md:p-6">
            <p className="text-center text-sm font-black text-[#FAF8F5]">
              ⭐ {CHAT_SOCIAL_PROOF.headline}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {CHAT_SOCIAL_PROOF.items.map((item) => (
                <div key={item.label} className="text-center">
                  <p className="text-xl font-black text-orange-400">{item.value}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="meta-glass-panel mt-6 rounded-2xl px-5 py-4 text-center">
            <p className="text-sm font-bold text-[#FAF8F5]">{PRIVACY_TEXT.title}</p>
            <p className="mt-1 text-sm text-slate-400">{PRIVACY_TEXT.lines.join(' ')}</p>
          </div>

          <div className="mt-8">
            <MetaConsultationChat active={chatActive} onStarted={() => setChatActive(true)} />
          </div>
        </div>
      </section>

      <section className="border-y border-white/5 bg-[#0F0F10] py-12">
        <div className="container">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {SOCIAL_PROOF.map((item) => (
              <div key={item.label} className="text-center">
                <p className="text-2xl font-black text-orange-400 md:text-3xl">{item.value}</p>
                <p className="mt-1 text-sm font-semibold text-slate-400">{item.label}</p>
              </div>
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
            Why CraftSquare
          </h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {WHY_CRAFTSQUARE.map((item) => (
              <li key={item} className="meta-premium-card flex items-start gap-3 rounded-2xl p-5">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-orange-400" />
                <span className="font-semibold text-slate-200">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <MetaLandingGallery items={galleryItems} />

      <section className="bg-[#121214] py-16 md:py-24">
        <div className="container">
          <h2
            className="text-center text-3xl font-black text-[#FAF8F5] md:text-4xl"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            What Homeowners Say
          </h2>
          <div className="mt-10 flex gap-4 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {testimonials.map((review) => (
              <TestimonialCard key={review.id || review.customerName} review={review} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-br from-[#0F0F10] via-[#121214] to-[#0F0F10] py-20">
        <div className="container max-w-3xl text-center">
          <h2
            className="text-3xl font-black text-[#FAF8F5] md:text-5xl"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            Ready to Transform Your Home?
          </h2>
          <p className="mt-4 text-lg text-slate-400">Get Your Free AI Interior Estimate Today.</p>
          <Button
            type="button"
            onClick={() => startConsultation(setChatActive, consultationRef)}
            className="meta-cta-primary mt-8 h-14 rounded-full bg-orange-600 px-10 text-base font-black text-white hover:bg-orange-500"
          >
            Start AI Consultation
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

      <MetaFloatingWhatsApp />
    </div>
  );
}
