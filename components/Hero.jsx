'use client';

import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Home,
  MessageCircle,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { whatsappUrl } from '@/lib/brand';
import LeadForm from '@/components/LeadForm';

const trustStats = [
  { label: 'Mumbai spaces transformed', value: '850+', icon: Home },
  { label: 'Average rating', value: '4.9/5', icon: Star },
  { label: 'Warranty-backed projects', value: '5 Year+', icon: ShieldCheck },
  { label: 'Consultation booking time', value: '30 sec', icon: Clock },
];

export default function Hero({ onLeadCreated, onQuote }) {
  return (
    <section className="relative overflow-hidden bg-slate-950 text-white pt-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(249,115,22,0.45),transparent_28%),radial-gradient(circle_at_85%_0%,rgba(14,165,233,0.20),transparent_30%)]" />
      <div className="absolute left-1/2 top-16 h-72 w-72 -translate-x-1/2 rounded-full bg-orange-500/20 blur-3xl" />
      <div className="container relative grid min-h-[800px] items-center gap-10 py-24 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <Badge className="mb-5 border border-orange-300/40 bg-white/10 px-4 py-2 text-orange-100 backdrop-blur hover:bg-white/10">
            Mumbai&apos;s Premium Interior Design Studio
          </Badge>
          <h1 className="max-w-4xl text-5xl font-black tracking-tight md:text-7xl" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Premium Interior Design & Solutions
          </h1>
          <p className="mt-6 max-w-2xl text-xl leading-8 text-slate-300">
            Transform your space with expert interior design, modular kitchens, wardrobes, rental interiors and turnkey execution — all under one trusted Mumbai brand.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="#quote">
              <Button size="lg" className="w-full bg-orange-600 px-8 font-black text-white hover:bg-orange-700 sm:w-auto rounded-full">
                Book Free Consultation <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </a>
            <button onClick={onQuote} className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-8 py-3 text-base font-black text-white backdrop-blur hover:bg-white/20 transition-colors">
              Get Instant Estimate
            </button>
            <a href={whatsappUrl} target="_blank" rel="noreferrer">
              <Button size="lg" variant="outline" className="w-full border-emerald-500/40 bg-emerald-500/10 px-8 font-black text-emerald-200 backdrop-blur hover:bg-emerald-500/20 sm:w-auto rounded-full">
                <MessageCircle className="mr-2 h-5 w-5" /> WhatsApp Consultation
              </Button>
            </a>
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            {['Residential Interiors', 'Modular Kitchen', 'Wardrobes', 'Rental Furnishing', 'Turnkey Projects', 'Commercial'].map((service) => (
              <span key={service} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/8 px-4 py-1.5 text-sm font-semibold text-slate-200 backdrop-blur">
                <CheckCircle2 className="h-3.5 w-3.5 text-orange-300" /> {service}
              </span>
            ))}
          </div>

          <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
            {trustStats.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <Icon className="mb-3 h-5 w-5 text-orange-300" />
                  <p className="text-2xl font-black">{item.value}</p>
                  <p className="text-xs text-slate-300">{item.label}</p>
                </div>
              );
            })}
          </div>
        </div>
        <div id="quote" className="relative">
          <div className="absolute -left-4 -top-4 h-24 w-24 rounded-full bg-orange-500 blur-2xl" />
          <LeadForm onLeadCreated={onLeadCreated} />
        </div>
      </div>
    </section>
  );
}
