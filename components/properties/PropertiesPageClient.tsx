'use client';

import Link from 'next/link';
import { Home, KeyRound, MessageCircle, Phone, Sofa, Tag, Building2 } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import Footer from '@/components/Footer';
import PropertiesLeadForm from '@/components/properties/PropertiesLeadForm';
import {
  PROPERTIES_BRAND_NAME,
  PROPERTIES_CONTACT_NAME,
  PROPERTIES_PHONE_DISPLAY,
  PROPERTIES_PHONE_E164,
  PROPERTIES_WEBSITE,
  PROPERTIES_WHATSAPP_URL,
} from '@/lib/properties/constants';

const BODY_FONT = { fontFamily: "'DM Sans', sans-serif" };
const HEADING_FONT = { fontFamily: "'Cormorant Garamond', serif" };

const SERVICES = [
  {
    icon: Home,
    title: 'Buying a home',
    text: 'Tell us your budget, preferred area and must-haves. We share suitable resale and new options and arrange site visits.',
  },
  {
    icon: Tag,
    title: 'Selling your flat',
    text: 'We help you price sensibly, present your home well and connect with genuine buyers.',
  },
  {
    icon: KeyRound,
    title: 'Renting a flat',
    text: 'Furnished, semi-furnished or bare-shell homes for families and working professionals.',
  },
  {
    icon: Building2,
    title: 'Renting out your flat',
    text: 'We find suitable tenants for your flat and coordinate visits on your behalf.',
  },
  {
    icon: Sofa,
    title: 'Home interiors',
    text: 'Furnishing, modular kitchens, wardrobes and full interiors through our sister brand, CraftSquare Studio.',
  },
];

const AREAS = ['Goregaon', 'Malad', 'Kandivali', 'Borivali'];

function SiteNav() {
  return (
    <nav className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/95 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between gap-3">
        <Link href="/" className="flex items-center">
          <BrandLogo variant="nav" className="" />
        </Link>
        <div className="hidden items-center gap-5 text-sm font-semibold text-slate-300 md:flex">
          <Link href="/" className="transition-colors hover:text-white">Interiors</Link>
          <Link href="/properties" className="text-white">Properties</Link>
          <Link href="/about" className="transition-colors hover:text-white">About</Link>
          <a href="#enquire" className="transition-colors hover:text-white">Enquire</a>
        </div>
        <a href={PROPERTIES_WHATSAPP_URL} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-full bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700 sm:px-4">
          <MessageCircle className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">WhatsApp</span>
        </a>
      </div>
    </nav>
  );
}

export default function PropertiesPageClient() {
  return (
    <>
      <main className="min-h-screen bg-white text-slate-800" style={BODY_FONT}>
        <SiteNav />

        <section className="bg-slate-950 py-16 text-white md:py-24">
          <div className="container max-w-5xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-400">Mumbai · Western suburbs</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl" style={HEADING_FONT}>
              {PROPERTIES_BRAND_NAME}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
              Help with buying, selling and renting homes in Mumbai&apos;s western suburbs, from Goregaon to
              Borivali. Home interiors through CraftSquare Studio.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#enquire" className="rounded-full bg-orange-600 px-6 py-3 text-sm font-black text-white hover:bg-orange-700">
                Share your requirement
              </a>
              <a href={PROPERTIES_WHATSAPP_URL} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-full bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700">
                <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp Arun
              </a>
              <a href={`tel:${PROPERTIES_PHONE_E164}`} className="inline-flex items-center rounded-full border border-white/30 px-6 py-3 text-sm font-bold text-white hover:bg-white/10">
                <Phone className="mr-2 h-4 w-4" /> {PROPERTIES_PHONE_DISPLAY}
              </a>
            </div>
          </div>
        </section>

        <section className="py-14 md:py-20">
          <div className="container max-w-5xl">
            <h2 className="text-3xl font-black text-slate-950 md:text-4xl" style={HEADING_FONT}>How we can help</h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {SERVICES.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <Icon className="h-6 w-6 text-orange-600" />
                  <h3 className="mt-4 text-lg font-black text-slate-950">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-slate-100 bg-slate-50 py-14">
          <div className="container max-w-5xl">
            <h2 className="text-3xl font-black text-slate-950 md:text-4xl" style={HEADING_FONT}>Where we work</h2>
            <p className="mt-3 max-w-2xl text-slate-600">
              We mainly work in Mumbai&apos;s western suburbs, from Goregaon to Borivali.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {AREAS.map((area) => (
                <span key={area} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                  {area}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section id="enquire" className="scroll-mt-20 py-14 md:py-20">
          <div className="container grid max-w-5xl gap-10 lg:grid-cols-[1fr_1.3fr]">
            <div>
              <h2 className="text-3xl font-black text-slate-950 md:text-4xl" style={HEADING_FONT}>Tell us what you need</h2>
              <p className="mt-3 text-slate-600">
                Share a few details and we will get back to you. Prefer to talk? Call or WhatsApp directly.
              </p>
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <p className="font-black text-slate-950">{PROPERTIES_BRAND_NAME}</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  <li>Contact {PROPERTIES_CONTACT_NAME}, <a className="font-semibold text-orange-600 hover:text-orange-700" href={`tel:${PROPERTIES_PHONE_E164}`}>{PROPERTIES_PHONE_DISPLAY}</a></li>
                  <li><a className="font-semibold text-emerald-700 hover:text-emerald-800" href={PROPERTIES_WHATSAPP_URL} target="_blank" rel="noreferrer">WhatsApp {PROPERTIES_PHONE_DISPLAY}</a></li>
                  <li><Link className="font-semibold text-orange-600 hover:text-orange-700" href="/">{PROPERTIES_WEBSITE}</Link></li>
                  <li>Mumbai, Maharashtra</li>
                </ul>
              </div>
            </div>
            <PropertiesLeadForm />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
