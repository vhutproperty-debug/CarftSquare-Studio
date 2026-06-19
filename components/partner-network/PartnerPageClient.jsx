'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Building2, CheckCircle2, ChevronDown, Handshake,
  LineChart, Shield, Sparkles, Users, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import BrandLogo from '@/components/BrandLogo';
import PartnerCallbackModal from '@/components/partner-network/PartnerCallbackModal';
import { TRUST_COUNTER_LABELS, DEFAULT_TRUST_COUNTERS } from '@/lib/partner-network/constants';

const WHY_PARTNER = [
  'Earn referral rewards on successful interior projects',
  'No execution responsibility',
  'No investment required',
  'Dedicated support from CraftSquare',
  'Transparent lead and payout tracking',
  'Convert your existing network into recurring income',
];

const WHO_CAN_JOIN = [
  'Property Brokers',
  'Estate Consultants',
  'Channel Partners',
  'Rental Brokers',
  'Property Advisors',
  'Society Network Members',
];

const TIMELINE = [
  'Register as a Referral Partner',
  'Refer a Homeowner',
  'CraftSquare Designs & Executes',
  'Project Gets Completed',
  'Receive Your Referral Reward',
];

const PARTNER_BENEFITS = [
  'Earn referral rewards on successful interior projects',
  'No execution responsibility',
  'No investment required',
  'Dedicated support from CraftSquare',
  'Transparent lead and payout tracking',
  'Convert your existing network into recurring income',
];

const FAQ = [
  { q: 'Who can join?', a: 'Local real estate brokers, channel partners, estate consultants, rental agents, and property advisors who already work with homeowners and landlords across Mumbai, Thane, and Navi Mumbai.' },
  { q: 'Is registration free?', a: 'Yes. Referral partner registration is completely free. Approval is subject to verification.' },
  { q: 'How do referrals work?', a: 'Refer clients who need interiors, renovation, modular kitchens, or rental furnishing. CraftSquare handles design and execution while you earn referral rewards on successful projects.' },
  { q: 'Can I submit multiple clients?', a: 'Yes. Approved referral partners can refer unlimited qualified clients through the partner portal.' },
  { q: 'How do I track referrals?', a: 'Your partner dashboard shows lead status, project pipeline, referral rewards pending, and activity timeline in real time.' },
  { q: 'When are rewards released?', a: 'Referral rewards are released after project completion and quality verification, as per partner agreement terms.' },
];

const ROADMAP = [
  'AI Partner Assistant', 'AI Rental ROI Estimator', 'AI Furnishing Budget Predictor',
  'AI Property Readiness Score', 'Partner Mobile App', 'Partner Wallet',
  'Automated Referral Rewards', 'AI Sales Assistant',
];

function AnimatedCounter({ value, suffix = '' }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      const target = Number(value) || 0;
      let start = 0;
      const step = Math.ceil(target / 40);
      const timer = setInterval(() => {
        start += step;
        if (start >= target) { setCount(target); clearInterval(timer); }
        else setCount(start);
      }, 30);
      observer.disconnect();
    }, { threshold: 0.3 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  return <span ref={ref}>{count}{suffix}</span>;
}

export default function PartnerPageClient() {
  const [counters, setCounters] = useState(DEFAULT_TRUST_COUNTERS);
  const [openFaq, setOpenFaq] = useState(null);
  const [callbackOpen, setCallbackOpen] = useState(false);

  useEffect(() => {
    fetch('/api/partner-network/trust-stats')
      .then((r) => r.json())
      .then((d) => { if (d.counters) setCounters(d.counters); })
      .catch(() => {});
  }, []);

  return (
    <main className="min-h-screen bg-white text-slate-950" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <nav className="fixed left-0 right-0 top-0 z-40 border-b border-white/10 bg-slate-950/95 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/"><BrandLogo variant="nav" /></Link>
          <div className="hidden items-center gap-6 text-sm font-semibold text-slate-300 md:flex">
            <Link href="/estimate" className="hover:text-white">AI Estimate</Link>
            <Link href="/blog" className="hover:text-white">Blog</Link>
            <Link href="/partner" className="text-orange-400">Partner Network</Link>
          </div>
          <div className="flex gap-2">
            <Link href="/partner/login"><Button variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">Partner Login</Button></Link>
            <a href="#register"><Button className="bg-orange-600 font-bold text-white hover:bg-orange-700">Become a Referral Partner</Button></a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-950 pb-24 pt-32 text-white md:pb-32 md:pt-40">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(249,115,22,0.15),_transparent_50%)]" />
        <div className="container relative max-w-5xl text-center">
          <Badge className="mb-6 bg-orange-500/20 text-orange-300 hover:bg-orange-500/20">Broker Referral Program</Badge>
          <h1 className="text-4xl font-black leading-tight md:text-6xl lg:text-7xl" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Turn Your Existing Property Clients into Extra Monthly Income
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-300 md:text-xl">
            Refer homeowners who need interiors, renovation, modular kitchens, or rental furnishing. CraftSquare handles the design and execution while you earn referral rewards.
          </p>
          <Badge className="mb-2 mt-6 bg-orange-500/20 text-base font-black text-orange-200 hover:bg-orange-500/20 md:text-lg">
            Earn ₹50,000 to ₹2,00,000+ Per Month Through Referrals*
          </Badge>
          <p className="mx-auto max-w-xl text-xs text-slate-400">
            *Income depends on successful referrals and project value.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a href="#register"><Button size="lg" className="h-14 rounded-full bg-orange-600 px-8 text-base font-black hover:bg-orange-700">Become a Referral Partner <ArrowRight className="ml-2 h-5 w-5" /></Button></a>
            <Button size="lg" variant="outline" type="button" onClick={() => setCallbackOpen(true)} className="h-14 rounded-full border-white/20 bg-white/5 px-8 text-white hover:bg-white/10">Request a Callback</Button>
            <a href="#how-it-works"><Button size="lg" variant="outline" className="h-14 rounded-full border-white/20 bg-white/5 px-8 text-white hover:bg-white/10">How It Works</Button></a>
          </div>
        </div>
      </section>

      {/* Trust counters */}
      <section className="border-b border-slate-100 bg-slate-50 py-16">
        <div className="container">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {Object.entries(counters).map(([key, value]) => (
              <div key={key} className="text-center">
                <p className="text-3xl font-black text-orange-600 md:text-4xl">
                  <AnimatedCounter value={value} suffix={key === 'customerSatisfaction' ? '%' : key.includes('Coverage') ? '%' : '+'} />
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-600">{TRUST_COUNTER_LABELS[key] || key}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why partner */}
      <section className="py-20 md:py-28">
        <div className="container">
          <h2 className="text-center text-3xl font-black md:text-5xl" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Why Refer With CraftSquare</h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-slate-600">You already have clients. Refer them to CraftSquare for interiors and earn additional income — without execution responsibility.</p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {WHY_PARTNER.map((item) => (
              <Card key={item} className="border-slate-100 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                <CardContent className="flex items-start gap-3 p-5">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
                  <span className="font-bold text-slate-800">{item}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Who can join */}
      <section className="bg-slate-950 py-20 text-white md:py-28">
        <div className="container">
          <h2 className="text-center text-3xl font-black md:text-5xl" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Who Can Join</h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {WHO_CAN_JOIN.map((role) => (
              <Card key={role} className="border-white/10 bg-white/5 text-white backdrop-blur">
                <CardContent className="flex items-center gap-3 p-5">
                  <Users className="h-5 w-5 text-orange-400" />
                  <span className="font-bold">{role}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 md:py-28">
        <div className="container max-w-4xl">
          <h2 className="text-center text-3xl font-black md:text-5xl" style={{ fontFamily: "'Cormorant Garamond', serif" }}>How It Works</h2>
          <div className="mt-12 space-y-0">
            {TIMELINE.map((step, i) => (
              <div key={step} className="flex flex-col items-center">
                <div className="flex w-full max-w-md items-center gap-4 rounded-2xl border border-slate-100 bg-white px-6 py-4 shadow-sm">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-600 text-sm font-black text-white">{i + 1}</span>
                  <span className="text-lg font-bold text-slate-900">{step}</span>
                </div>
                {i < TIMELINE.length - 1 && <ChevronDown className="my-2 h-6 w-6 text-orange-400" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits + About */}
      <section className="bg-slate-50 py-20 md:py-28">
        <div className="container grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-black md:text-4xl" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Partner Benefits</h2>
            <ul className="mt-6 space-y-3 text-slate-700">
              {PARTNER_BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-2"><Sparkles className="mt-1 h-4 w-4 shrink-0 text-orange-600" /><span>{b}</span></li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-3xl font-black md:text-4xl" style={{ fontFamily: "'Cormorant Garamond', serif" }}>About The Referral Program</h2>
            <p className="mt-6 leading-8 text-slate-700">Every property client is a potential interior opportunity. CraftSquare helps brokers and consultants earn referral rewards by connecting homeowners to professional interior design, renovation, modular kitchens, and rental furnishing — without taking on execution work.</p>
            <p className="mt-4 leading-8 text-slate-600">Real estate brokers can earn an additional ₹50,000–₹2,00,000+ per month by referring interior projects to CraftSquare. We handle design, execution, and client delivery while you focus on your core business.</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 md:py-28">
        <div className="container max-w-3xl">
          <h2 className="text-center text-3xl font-black md:text-5xl" style={{ fontFamily: "'Cormorant Garamond', serif" }}>FAQ</h2>
          <div className="mt-10 space-y-3">
            {FAQ.map((item, i) => (
              <div key={item.q} className="rounded-2xl border border-slate-100">
                <button type="button" className="flex w-full items-center justify-between px-6 py-4 text-left font-bold text-slate-900" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  {item.q}
                  <ChevronDown className={`h-5 w-5 transition ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && <p className="border-t border-slate-100 px-6 py-4 text-slate-600">{item.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Registration — solid section bg; glass effect only on card shell */}
      <section id="register" className="relative isolate bg-slate-950 py-16 md:py-20">
        <div className="container relative z-10 mx-auto max-w-3xl px-4">
          <h2 className="text-center text-3xl font-black text-white md:text-4xl" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Your Network Can Earn More.</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm font-medium text-[#9CA3AF] md:text-base">If you already help clients buy, sell, or rent homes, you can also earn by referring them for interior solutions through CraftSquare.</p>
          <div className="partner-reg-card mx-auto mt-6 max-w-2xl p-6 text-center md:p-8">
            <p className="text-sm text-[#E5E7EB]">Create your partner account with email OTP verification in one secure flow.</p>
            <Link href="/partner/login?mode=register" className="mt-6 inline-block">
              <Button className="h-12 rounded-full bg-orange-600 px-8 text-sm font-bold text-white hover:bg-orange-500">
                Join the CraftSquare Referral Program
              </Button>
            </Link>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCallbackOpen(true)}
              className="mt-4 h-12 rounded-full border-white/20 bg-white/5 px-8 text-sm font-bold text-white hover:bg-white/10"
            >
              Request a Callback
            </Button>
            <p className="mt-4 text-sm text-[#9CA3AF]">
              Already registered? <Link href="/partner/login" className="font-semibold text-orange-400 hover:underline">Partner Login</Link>
            </p>
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section className="py-20 md:py-28">
        <div className="container">
          <div className="text-center">
            <Badge className="mb-4 bg-orange-100 text-orange-700 hover:bg-orange-100">Coming Soon</Badge>
            <h2 className="text-3xl font-black md:text-5xl" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Investor Roadmap</h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-600">Future vision for India&apos;s leading AI-powered interior & property enablement platform.</p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ROADMAP.map((item) => (
              <Card key={item} className="border-dashed border-orange-200 bg-orange-50/50">
                <CardContent className="flex items-center gap-3 p-5">
                  <Zap className="h-5 w-5 text-orange-600" />
                  <span className="font-bold text-slate-800">{item}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 bg-white py-8 text-center text-sm text-slate-500">
        <p>© 2025 CraftSquare Studio — AI-Powered Interior & Property Enablement Platform</p>
        <Link href="/" className="mt-2 inline-block font-bold text-orange-600">Back to homepage</Link>
      </footer>

      <PartnerCallbackModal open={callbackOpen} onOpenChange={setCallbackOpen} />
    </main>
  );
}
