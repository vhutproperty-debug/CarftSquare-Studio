'use client';

import { useRef, useState, type ComponentType } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  Building2,
  Check,
  ChevronDown,
  Home,
  MessageCircle,
  Paintbrush,
  Phone,
  Shield,
  TreeDeciduous,
  Users,
  Wrench,
} from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import PaintingAnalytics, { trackPaintingCallClick, trackPaintingWhatsAppClick } from '@/components/painting/PaintingAnalytics';
import PaintingGallery from '@/components/painting/PaintingGallery';
import PaintingLeadForm from '@/components/painting/PaintingLeadForm';
import PaintingStickyCta from '@/components/painting/PaintingStickyCta';
import PaintingTestimonials from '@/components/painting/PaintingTestimonials';
import {
  FAQ_ITEMS,
  HERO_HEADLINE,
  HERO_SUBHEADLINE,
  PAINT_BRANDS,
  PROCESS_STEPS,
  SERVICES,
  TRUST_BADGES,
  WHY_CHOOSE,
} from '@/lib/painting/content';
import { PAINTING_PHONE_DISPLAY, PAINTING_WHATSAPP_URL } from '@/lib/painting/constants';
import type { PaintingGalleryItem } from '@/lib/painting/types';
import '@/components/painting/painting.css';

const SERVICE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  home: Home,
  building: Building2,
  brush: Paintbrush,
  shield: Shield,
  tree: TreeDeciduous,
  wrench: Wrench,
  users: Users,
  briefcase: Briefcase,
};

type TestimonialCard = {
  id: string;
  name: string;
  location: string;
  rating: number;
  text: string;
  projectType: string;
};

type PaintingLandingClientProps = {
  galleryItems?: PaintingGalleryItem[];
  testimonials?: TestimonialCard[];
  heroImage?: string | null;
};

function scrollToRef(ref: { current: HTMLElement | null }) {
  ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function FaqItem({
  item,
  open,
  onToggle,
}: {
  item: { q: string; a: string };
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="painting-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="font-semibold text-slate-900">{item.q}</span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-orange-600 transition ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <p className="border-t border-slate-100 px-5 py-4 text-sm leading-7 text-slate-600">{item.a}</p>
      )}
    </div>
  );
}

export default function PaintingLandingClient({
  galleryItems = [],
  testimonials = [],
  heroImage = null,
}: PaintingLandingClientProps) {
  const formRef = useRef<HTMLElement>(null);
  const [openFaq, setOpenFaq] = useState(0);

  function bookInspection() {
    scrollToRef(formRef);
  }

  return (
    <div className="painting-page painting-sticky-cta min-h-screen" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <PaintingAnalytics />

      <header className="painting-glass sticky top-0 z-40">
        <div className="container flex h-16 items-center justify-between">
          <Link
            href="/"
            className="inline-flex rounded-lg transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
            aria-label="CraftSquare Studio — Back to homepage"
          >
            <BrandLogo variant="nav" />
          </Link>
          <div className="hidden items-center gap-3 sm:flex">
            <a
              href={`tel:${PAINTING_PHONE_DISPLAY.replace(/\s/g, '')}`}
              className="text-sm font-semibold text-slate-600 hover:text-orange-600"
              onClick={() => trackPaintingCallClick('header')}
            >
              {PAINTING_PHONE_DISPLAY}
            </a>
            <Button type="button" onClick={bookInspection} className="painting-cta-primary h-10 px-5 text-sm">
              Book Free Site Visit
            </Button>
          </div>
        </div>
      </header>

      <section className="painting-hero-gradient relative overflow-hidden py-16 md:py-24">
        {heroImage ? (
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage: `url(${heroImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
            aria-hidden="true"
          />
        ) : null}
        <div className="container relative">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-600">Mumbai · Professional Painters</p>
            <h1
              className="mt-4 text-4xl font-bold leading-[1.1] text-slate-900 md:text-5xl lg:text-6xl"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              {HERO_HEADLINE}
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600 md:text-xl">{HERO_SUBHEADLINE}</p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button type="button" onClick={bookInspection} className="painting-cta-primary h-14 px-8 text-base">
                Book Free Site Visit
              </Button>
              <a
                href={PAINTING_WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="painting-cta-secondary inline-flex h-14 items-center justify-center gap-2 px-8 text-base"
                onClick={() => trackPaintingWhatsAppClick('hero')}
              >
                <MessageCircle className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                Get Free Quote on WhatsApp
              </a>
            </div>

            <ul className="mt-10 flex flex-wrap justify-center gap-2">
              {TRUST_BADGES.map((badge) => (
                <li key={badge} className="painting-badge">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  {badge}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-white py-16 md:py-24" aria-labelledby="painting-services-heading">
        <div className="container">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Services</p>
            <h2
              id="painting-services-heading"
              className="mt-3 text-3xl font-bold text-slate-900 md:text-4xl"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              Complete Painting Solutions
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map((service) => {
              const Icon = SERVICE_ICONS[service.icon] || Paintbrush;
              return (
                <article key={service.id} className="painting-card p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 font-bold text-slate-900">{service.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{service.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[#f5f5f7] py-16 md:py-24" aria-labelledby="painting-why-heading">
        <div className="container">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Why CraftSquare</p>
            <h2
              id="painting-why-heading"
              className="mt-3 text-3xl font-bold text-slate-900 md:text-4xl"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              Why Choose CraftSquare
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {WHY_CHOOSE.map((item) => (
              <article key={item.title} className="painting-card p-6">
                <h3 className="font-bold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 md:py-24" aria-labelledby="painting-process-heading">
        <div className="container">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Process</p>
            <h2
              id="painting-process-heading"
              className="mt-3 text-3xl font-bold text-slate-900 md:text-4xl"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              Our Painting Process
            </h2>
          </div>
          <ol className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2 lg:grid-cols-3">
            {PROCESS_STEPS.map((step) => (
              <li key={step.step} className="painting-card relative p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-600 text-sm font-bold text-white">
                  {step.step}
                </span>
                <h3 className="mt-4 font-bold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <PaintingGallery items={galleryItems} />

      <section className="bg-[#f5f5f7] py-16 md:py-24" aria-labelledby="painting-brands-heading">
        <div className="container">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Premium Paints</p>
            <h2
              id="painting-brands-heading"
              className="mt-3 text-3xl font-bold text-slate-900 md:text-4xl"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              Trusted Paint Brands
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PAINT_BRANDS.map((brand) => (
              <article key={brand.name} className="painting-brand-card painting-card p-6 text-center">
                <p className="text-xl font-bold text-slate-900">{brand.name}</p>
                <p className="mt-2 text-sm text-slate-500">{brand.tagline}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <PaintingTestimonials testimonials={testimonials} />

      <section className="bg-white py-16 md:py-24" aria-labelledby="painting-faq-heading">
        <div className="container max-w-3xl">
          <div className="mb-10 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">FAQ</p>
            <h2
              id="painting-faq-heading"
              className="mt-3 text-3xl font-bold text-slate-900 md:text-4xl"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              Painting Questions Answered
            </h2>
          </div>
          <div className="space-y-3">
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

      <section ref={formRef} className="bg-[#f5f5f7] py-16 md:py-24" aria-labelledby="painting-form-heading">
        <div className="container">
          <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Get Started</p>
              <h2
                id="painting-form-heading"
                className="mt-3 text-3xl font-bold text-slate-900 md:text-4xl"
                style={{ fontFamily: "'Cormorant Garamond', serif" }}
              >
                Ready for a Fresh, Premium Finish?
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Book a free site inspection. Our supervisor will assess your space and share a transparent estimate — no obligation.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={PAINTING_WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="painting-cta-secondary inline-flex h-11 items-center gap-2 px-5 text-sm"
                  onClick={() => trackPaintingWhatsAppClick('form_section')}
                >
                  <MessageCircle className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  WhatsApp
                </a>
                <a
                  href={`tel:${PAINTING_PHONE_DISPLAY.replace(/\s/g, '')}`}
                  className="painting-cta-secondary inline-flex h-11 items-center gap-2 px-5 text-sm"
                  onClick={() => trackPaintingCallClick('form_section')}
                >
                  <Phone className="h-4 w-4 text-orange-600" aria-hidden="true" />
                  Call Now
                </a>
              </div>
            </div>
            <PaintingLeadForm />
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white py-10">
        <div className="container flex flex-col items-center justify-between gap-4 text-center text-sm text-slate-500 md:flex-row md:text-left">
          <p>© {new Date().getFullYear()} CraftSquare Studio. Premium painting services in Mumbai.</p>
          <Link href="/" className="font-semibold text-orange-600 hover:text-orange-700">
            craftsquare.co.in
          </Link>
        </div>
      </footer>

      <PaintingStickyCta onBookInspection={bookInspection} />
    </div>
  );
}
