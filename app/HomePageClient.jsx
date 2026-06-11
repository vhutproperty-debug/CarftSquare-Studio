'use client';

import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Award,
  BadgeCheck,
  BarChart3,
  Bot,
  Brain,
  Calculator,
  Camera,
  CheckCircle2,
  ChefHat,
  Grid3X3,
  Home,
  Layers,
  Layout,
  Lightbulb,
  Maximize2,
  MessageCircle,
  Package,
  Palette,
  ShieldCheck,
  Sofa,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BRAND, whatsappUrl } from '@/lib/brand';
import LeadForm, { Field } from '@/components/LeadForm';
import SectionHeader from '@/components/SectionHeader';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import Services from '@/components/Services';
import Portfolio from '@/components/Portfolio';
import Testimonials from '@/components/Testimonials';
import FAQ from '@/components/FAQ';
import Footer from '@/components/Footer';
import AboutSection from '@/components/AboutSection';

const brand = BRAND.name;

const whyChoose = [
  { title: 'Design-to-Execution', text: 'Single team handles design, modular work, furniture and final styling.', icon: Users },
  { title: 'Premium Materials', text: 'Curated materials and hardware from trusted global and Indian brands.', icon: BadgeCheck },
  { title: 'Dedicated Manager', text: 'One project owner for quote, schedule, execution and handover.', icon: Users },
  { title: 'Digital Quotation', text: 'Transparent scope, material recommendation and timeline in writing.', icon: BarChart3 },
  { title: 'Real-Time Tracking', text: 'Project status updates from design approval to final handover.', icon: BarChart3 },
  { title: 'Warranty-Backed', text: 'Structural warranty on modular work and workmanship guarantee.', icon: Sparkles },
];

const steps = [
  'Book Inspection',
  'Site Visit',
  'Get Digital Quote',
  'Start Work',
  'Quality Check',
  'Final Handover',
];

const modularKitchens = [
  { title: 'L-Shaped Kitchen', desc: 'Space-efficient design ideal for Mumbai apartments with optimized workflow and premium finishes.', icon: Grid3X3, tag: 'Most Popular' },
  { title: 'Parallel Kitchen', desc: 'Two parallel work zones for serious cooks. Maximum counter space in minimal footprint.', icon: Layout, tag: 'Space Saver' },
  { title: 'Island Kitchen', desc: 'Open-plan luxury kitchen with central island. Perfect for premium apartments and villas.', icon: Maximize2, tag: 'Premium' },
  { title: 'Acrylic Finish', desc: 'High-gloss acrylic shutters with mirror-like finish. Easy to clean and incredibly modern.', icon: Sparkles, tag: 'Trending' },
  { title: 'PU Finish Kitchen', desc: 'Polyurethane coating for ultra-smooth, durable finish. The choice for luxury homes.', icon: Award, tag: 'Luxury' },
  { title: 'Laminate Finish', desc: 'Durable and affordable laminate shutters in 200+ textures. Great value for premium look.', icon: Layers, tag: 'Value Pick' },
];

const wardrobeTypes = [
  { title: 'Sliding Wardrobes', desc: 'Space-saving sliding door wardrobes with mirrors and premium hardware. Perfect for Mumbai bedrooms.', icon: Maximize2, color: 'from-amber-50 to-orange-50' },
  { title: 'Hinged Wardrobes', desc: 'Classic hinged wardrobes with full interior fittings — drawers, shelves, hanging rods and more.', icon: Package, color: 'from-slate-50 to-slate-100' },
  { title: 'Walk-in Wardrobes', desc: 'Transform a room into a dream dressing room with full-height shelving and custom lighting.', icon: Layers, color: 'from-amber-50 to-yellow-50' },
  { title: 'Loft Storage', desc: 'Utilize every inch of vertical space with custom loft storage above doors and windows.', icon: TrendingUp, color: 'from-orange-50 to-red-50' },
  { title: 'Custom Storage', desc: 'Bespoke storage solutions designed around your specific lifestyle and space requirements.', icon: Zap, color: 'from-slate-50 to-blue-50' },
];

const interiorServices = [
  { title: 'Space Planning', desc: 'Expert layout optimization to maximize flow, light and function in your Mumbai home.', icon: Layout },
  { title: 'False Ceiling', desc: 'Gypsum, POP and designer false ceilings with integrated lighting and premium finishes.', icon: Layers },
  { title: 'Lighting Consultation', desc: 'Ambient, task and accent lighting design to transform the mood of every room.', icon: Lightbulb },
  { title: 'Furniture Layout', desc: 'Professional furniture arrangement and sourcing recommendations for each space.', icon: Sofa },
  { title: 'Material Consultation', desc: 'Expert guidance on tiles, floorings, laminates, hardware and surface materials.', icon: Package },
  { title: 'Color Consultation', desc: 'Professional color palette creation for a cohesive, premium look across your home.', icon: Palette },
];

const aiFuture = [
  { title: 'AI Room Visualizer', desc: 'Upload your room photo and preview interior designs instantly before committing. Powered by AI.', icon: Camera, status: 'Coming Soon', href: null },
  { title: 'AI Quotation Assistant', desc: 'Chat-based intelligent quote builder for interiors, kitchens, and wardrobes in seconds.', icon: Bot, status: 'Available Now', href: '/estimate' },
  { title: 'Smart Project Estimator', desc: 'Upload floor plan or enter dimensions for instant interior project cost estimate.', icon: Calculator, status: 'Available Now', href: '/estimate' },
  { title: 'Renovation Recommender', desc: 'AI-powered renovation priority suggestions based on your home type, age and budget.', icon: Brain, status: 'Coming Soon', href: null },
];

function InteriorSolutions() {
  return (
    <section id="interiors" className="bg-slate-950 py-24 text-white">
      <div className="container">
        <SectionHeader
          eyebrow="Interior Solutions"
          title="Complete interior design & consultation"
          text="From space planning to lighting, every element of your home designed with precision and crafted to perfection."
          light
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {interiorServices.map((service) => {
            const Icon = service.icon;
            return (
              <Card key={service.title} className="border-white/10 bg-white/5 backdrop-blur transition duration-300 hover:bg-white/10 hover:-translate-y-1">
                <CardContent className="p-6">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/20 text-orange-300">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-black text-white">{service.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{service.desc}</p>
                  <a href="#quote" className="mt-5 inline-flex items-center text-sm font-bold text-orange-300">
                    Enquire now <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <div className="mt-12 rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <Badge className="mb-4 bg-orange-500 text-white hover:bg-orange-500">One-stop solution</Badge>
              <h3 className="text-3xl font-black" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Why handle multiple contractors when {brand} does it all?</h3>
              <p className="mt-4 text-slate-300">From the first design concept to the last cabinet handle — one team, one timeline, one point of contact for your complete interior transformation.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {['Single point of contact', 'Unified timeline', 'Coordinated teams', 'One warranty guarantee'].map((point) => (
                <div key={point} className="flex items-center gap-3 rounded-2xl bg-white/10 p-4">
                  <CheckCircle2 className="h-5 w-5 flex-none text-orange-300" />
                  <span className="text-sm font-bold">{point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ModularKitchen() {
  const [activeFinish, setActiveFinish] = useState('Acrylic Finish');
  const finishes = ['Acrylic Finish', 'PU Finish Kitchen', 'Laminate Finish'];

  return (
    <section id="modular-kitchen" className="bg-gradient-to-br from-amber-50 via-orange-50/30 to-white py-24">
      <div className="container">
        <SectionHeader
          eyebrow="Modular Kitchen"
          title="Dream kitchens designed for Mumbai homes"
          text="From compact L-shaped kitchens to luxurious island designs — custom modular kitchens built with premium materials and precision engineering."
        />

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {modularKitchens.map((kitchen) => {
            const Icon = kitchen.icon;
            return (
              <Card key={kitchen.title} className="group overflow-hidden border-amber-100 bg-white shadow-sm transition duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-amber-950/10">
                <CardContent className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 transition group-hover:bg-amber-600 group-hover:text-white">
                      <Icon className="h-6 w-6" />
                    </div>
                    <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 text-xs">{kitchen.tag}</Badge>
                  </div>
                  <h3 className="text-lg font-black text-slate-950">{kitchen.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{kitchen.desc}</p>
                  <a href="#quote" className="mt-5 inline-flex items-center text-sm font-black text-slate-950">
                    Get design quote <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-14 rounded-3xl bg-slate-950 p-8 text-white">
          <div className="mb-8 text-center">
            <Badge className="mb-3 bg-orange-500 text-white hover:bg-orange-500">Material Comparison</Badge>
            <h3 className="text-3xl font-black" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Choose your kitchen finish</h3>
          </div>
          <div className="flex gap-2 mb-6 justify-center flex-wrap">
            {finishes.map((finish) => (
              <button
                key={finish}
                onClick={() => setActiveFinish(finish)}
                className={`rounded-full px-5 py-2 text-sm font-bold transition ${activeFinish === finish ? 'bg-orange-600 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'}`}
              >
                {finish}
              </button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { label: 'Durability', acrylic: 85, pu: 95, laminate: 80 },
              { label: 'Shine / Gloss', acrylic: 95, pu: 90, laminate: 60 },
              { label: 'Affordability', acrylic: 70, pu: 50, laminate: 90 },
              { label: 'Easy Maintenance', acrylic: 90, pu: 85, laminate: 75 },
            ].map((attr) => {
              const val = activeFinish === 'Acrylic Finish' ? attr.acrylic : activeFinish === 'PU Finish Kitchen' ? attr.pu : attr.laminate;
              return (
                <div key={attr.label} className="rounded-2xl bg-white/10 p-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-bold">{attr.label}</span>
                    <span className="text-sm font-black text-orange-300">{val}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-orange-500 transition-all duration-500" style={{ width: `${val}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="/estimate/kitchen">
              <Button className="bg-orange-600 font-black text-white hover:bg-orange-700 rounded-full px-8">
                AI Kitchen Estimate <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </a>
            <a href="#quote" className="text-sm font-bold text-orange-600 hover:text-orange-700">
              Or request a design quote
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Wardrobes() {
  return (
    <section id="wardrobes" className="bg-white py-24">
      <div className="container">
        <SectionHeader
          eyebrow="Wardrobe Solutions"
          title="Custom wardrobes for every Mumbai bedroom"
          text="Maximize every square foot of your Mumbai home with precision-designed wardrobes crafted for your lifestyle and space."
        />
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {wardrobeTypes.map((wardrobe) => {
            const Icon = wardrobe.icon;
            return (
              <Card key={wardrobe.title} className={`group overflow-hidden border-0 bg-gradient-to-br ${wardrobe.color} shadow-sm transition duration-300 hover:-translate-y-2 hover:shadow-xl`}>
                <CardContent className="p-6">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm text-slate-700 transition group-hover:scale-110">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-black text-slate-950">{wardrobe.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{wardrobe.desc}</p>
                  <a href="/estimate/wardrobe" className="mt-5 inline-flex items-center text-sm font-black text-slate-950">
                    AI Wardrobe Estimate <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-2 lg:items-center">
          <div className="rounded-3xl bg-slate-950 p-8 text-white">
            <Badge className="mb-4 bg-orange-500 text-white hover:bg-orange-500">Why {brand} Wardrobes</Badge>
            <h3 className="text-3xl font-black" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Built to last. Designed to impress.</h3>
            <div className="mt-6 space-y-4">
              {[
                ['German hardware', 'Hettich & Hafele fittings for smooth, silent operation'],
                ['Modular interiors', 'Drawers, shelves, accessories — every compartment custom'],
                ['Premium finishes', 'Laminate, acrylic, PU — matched to your interiors'],
                ['5-year warranty', 'Structural warranty on all wardrobe installations'],
              ].map(([title, desc]) => (
                <div key={title} className="flex gap-4 rounded-2xl bg-white/10 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-orange-300" />
                  <div>
                    <p className="font-black">{title}</p>
                    <p className="text-sm text-slate-300">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <Card className="border-orange-100 shadow-lg">
              <CardContent className="p-6">
                <ChefHat className="h-8 w-8 text-orange-600 mb-3" />
                <h4 className="text-xl font-black text-slate-950">Complete Home Bundle</h4>
                <p className="mt-2 text-slate-600">Book modular kitchen + wardrobes + complete interior styling together for the best pricing and a single coordinated timeline.</p>
                <div className="mt-4 flex items-center gap-3">
                  <Badge className="bg-green-100 text-green-700">Save up to 15%</Badge>
                  <Badge className="bg-orange-100 text-orange-700">Priority scheduling</Badge>
                </div>
                <a href="#quote" className="mt-4 inline-flex items-center text-sm font-black text-orange-600">
                  Get bundle quote <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </CardContent>
            </Card>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-orange-50 p-5 text-center">
                <p className="text-3xl font-black text-orange-600">500+</p>
                <p className="text-sm text-slate-600 mt-1">Wardrobes installed</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-5 text-center">
                <p className="text-3xl font-black text-slate-950">5yr</p>
                <p className="text-sm text-slate-600 mt-1">Structural warranty</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CalculatorSection({ onLeadCreated }) {
  return (
    <section id="calculator" className="bg-slate-50 py-24">
      <div className="container grid items-start gap-10 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="sticky top-24">
          <Badge className="mb-4 bg-orange-100 text-orange-700 hover:bg-orange-100">Instant cost calculator</Badge>
          <h2 className="text-4xl font-black tracking-tight text-slate-950 md:text-5xl" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Get instant Mumbai home transformation estimate.
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            Estimate cost for residential interiors, modular kitchens, wardrobes, rental furnishing and complete renovation — all in one form.
          </p>
          <a href="/estimate" className="mt-4 inline-flex items-center text-sm font-black text-orange-600 hover:text-orange-700">
            Prefer AI consultation? Get instant AI estimate <ArrowRight className="ml-2 h-4 w-4" />
          </a>
          <div className="mt-8 grid gap-4">
            {[
              ['Material suggestion', 'Material and finish recommendation based on project scope and finish level.'],
              ['Labor estimate', 'Separates material and execution planning costs clearly.'],
              ['CRM-ready lead', 'Every request lands in the backend admin dashboard instantly.'],
            ].map(([title, text]) => (
              <div key={title} className="flex gap-4 rounded-2xl bg-white p-4 shadow-sm">
                <CheckCircle2 className="mt-1 h-5 w-5 flex-none text-orange-600" />
                <div>
                  <p className="font-black text-slate-950">{title}</p>
                  <p className="text-sm text-slate-600">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <LeadForm onLeadCreated={onLeadCreated} />
      </div>
    </section>
  );
}

function WhyChoose() {
  return (
    <section className="bg-white py-24">
      <div className="container">
        <SectionHeader eyebrow="Why choose us" title="Built like a premium service company, not a contractor directory" text="The operating model combines local Mumbai execution with startup-grade transparency, tracking and trust across all services." />
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {whyChoose.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} className="border-slate-100 bg-gradient-to-br from-white to-slate-50 transition duration-300 hover:-translate-y-1 hover:shadow-lg">
                <CardContent className="flex gap-5 p-6">
                  <div className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-slate-950 text-orange-300">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-950">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="overflow-hidden bg-slate-950 py-24 text-white">
      <div className="container">
        <SectionHeader eyebrow="How it works" title="A seamless 6-step design journey" text="From consultation to warranty, every step is structured to minimize confusion and maximize trust — for interiors, kitchens, wardrobes and more." light />
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {steps.map((step, index) => (
            <div key={step} className="relative rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur transition hover:bg-white/15">
              <div className="mb-8 flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-sm font-black text-white">{index + 1}</div>
              <p className="font-black">{step}</p>
              <p className="mt-2 text-xs leading-5 text-slate-300">{index === 0 ? 'Submit form or WhatsApp' : index === 2 ? 'Approve clear scope' : index === 5 ? 'Photos + warranty' : 'Managed by project owner'}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RentalInteriorsSection({ rental }) {
  if (!rental?.service) return null;
  const subServices = rental.subServices || [];

  return (
    <section id="rental-interiors" className="bg-gradient-to-br from-orange-50 via-white to-slate-50 py-24">
      <div className="container">
        <SectionHeader
          eyebrow="Rental Furnishing"
          title={rental.service.name || 'Rental Furnishing Solutions'}
          text={rental.service.shortDescription || rental.service.description}
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {subServices.slice(0, 8).map((sub) => (
            <Card key={sub.id} className="group border-orange-100 bg-white transition duration-300 hover:-translate-y-2 hover:shadow-xl">
              <CardContent className="p-6">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
                  <Home className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-black text-slate-950">{sub.name}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{sub.description}</p>
                <a href="/rental-interiors" className="mt-5 inline-flex items-center text-sm font-black text-orange-600">
                  Learn more <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href="/estimate" className="inline-flex items-center rounded-full bg-orange-600 px-8 py-3 text-sm font-black text-white hover:bg-orange-700">
            Get AI Furnishing Estimate <ArrowRight className="ml-2 h-4 w-4" />
          </a>
          <a href="/rental-interiors" className="inline-flex items-center rounded-full border border-orange-200 px-8 py-3 text-sm font-black text-orange-600 hover:bg-orange-50">
            Explore Rental Furnishing
          </a>
        </div>
      </div>
    </section>
  );
}

function TrustSection() {
  return (
    <section className="bg-gradient-to-br from-orange-50 to-white py-24">
      <div className="container">
        <SectionHeader eyebrow="Trust & guarantees" title={`Why 850+ Mumbai families choose ${brand}`} text="Every promise backed by process, every project backed by warranty." />
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="border-0 bg-slate-950 text-white shadow-xl">
            <CardContent className="p-8 text-center">
              <ShieldCheck className="mx-auto h-12 w-12 text-orange-400 mb-4" />
              <h3 className="text-2xl font-black mb-3" style={{ fontFamily: "'Cormorant Garamond', serif" }}>1-Year Warranty</h3>
              <p className="text-slate-300">Workmanship warranty on all eligible interior projects. Written, not verbal.</p>
            </CardContent>
          </Card>
          <Card className="border-orange-100 shadow-xl">
            <CardContent className="p-8 text-center">
              <Award className="mx-auto h-12 w-12 text-orange-600 mb-4" />
              <h3 className="text-2xl font-black text-slate-950 mb-3" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Certified Teams</h3>
              <p className="text-slate-600">Background-checked, trained professionals for every service — interiors, kitchens, wardrobes.</p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-orange-600 text-white shadow-xl">
            <CardContent className="p-8 text-center">
              <BadgeCheck className="mx-auto h-12 w-12 text-white mb-4" />
              <h3 className="text-2xl font-black mb-3" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Price Guarantee</h3>
              <p className="text-orange-100">Transparent digital quotes. No hidden charges. What&apos;s quoted is what&apos;s billed.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

function AIFeaturesSection() {
  return (
    <section id="ai-features" className="bg-slate-950 py-24 text-white">
      <div className="container">
        <SectionHeader
          eyebrow="AI-Powered Future"
          title="Intelligent home transformation tools — coming soon"
          text="We're building the next generation of AI-powered home renovation tools to make designing your home faster, smarter and more accurate."
          light
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {aiFuture.map((feature) => {
            const Icon = feature.icon;
            const card = (
              <Card className="border-white/10 bg-white/5 backdrop-blur transition hover:bg-white/10">
                <CardContent className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/20 text-orange-300">
                      <Icon className="h-6 w-6" />
                    </div>
                    <Badge className={`text-xs border-white/20 ${feature.href ? 'bg-orange-500 text-white hover:bg-orange-500' : 'bg-white/10 text-slate-300 hover:bg-white/10'}`}>{feature.status}</Badge>
                  </div>
                  <h3 className="text-base font-black text-white">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{feature.desc}</p>
                  {feature.href && (
                    <span className="mt-5 inline-flex items-center text-sm font-black text-orange-300">
                      Start now <ArrowRight className="ml-2 h-4 w-4" />
                    </span>
                  )}
                </CardContent>
              </Card>
            );
            return feature.href ? (
              <a key={feature.title} href={feature.href} className="block">{card}</a>
            ) : (
              <div key={feature.title}>{card}</div>
            );
          })}
        </div>
        <div className="mt-8 text-center">
          <a href="/estimate">
            <Button className="bg-orange-600 font-black text-white hover:bg-orange-700 rounded-full px-8">
              Start AI Estimate <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}

function DashboardPreview() {
  const projectSteps = [
    { title: 'Consultation booked', text: `Your free design consultation is scheduled with the ${brand} team.` },
    { title: 'Digital quote shared', text: 'You receive a clear interior estimate and material plan.' },
    { title: 'Work started', text: 'Teams arrive on schedule with masking, materials and supervision.' },
    { title: 'Quality check', text: 'Finish, cleanup and touch-ups are checked before handover.' },
    { title: 'Warranty issued', text: 'Eligible work receives warranty guidance and final documentation.' },
  ];

  return (
    <section id="dashboard" className="bg-white py-24">
      <div className="container">
        <SectionHeader eyebrow="Track your project" title="Know every step from inspection to handover" text="After booking, follow a simple project journey: inspection, quote, work progress, quality check and warranty handover." />
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-slate-950 to-slate-800 text-white shadow-2xl shadow-slate-950/20">
          <CardContent className="grid gap-8 p-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <Badge className="bg-orange-500 text-white hover:bg-orange-500">Customer journey</Badge>
              <h3 className="mt-5 text-3xl font-black" style={{ fontFamily: "'Cormorant Garamond', serif" }}>A transparent managed home transformation experience.</h3>
              <p className="mt-4 text-slate-300">No confusion, no contractor follow-up stress. {brand} keeps your project journey clear from first call to final handover.</p>
              <a href="#quote">
                <Button className="mt-6 bg-orange-600 font-black text-white hover:bg-orange-700 rounded-full">Book Free Site Visit</Button>
              </a>
            </div>
            <div className="grid gap-3">
              {projectSteps.map((item, index) => (
                <div key={item.title} className="flex items-start gap-4 rounded-2xl bg-white/10 p-4 backdrop-blur">
                  <div className={`mt-1 flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-black ${index < 2 ? 'bg-orange-500 text-white' : 'bg-white/20 text-white'}`}>{index + 1}</div>
                  <div>
                    <p className="font-black">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-300">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function StickyCTA({ onOpen }) {
  return (
    <>
      <div className="fixed bottom-5 left-1/2 z-40 hidden w-[min(720px,calc(100%-2rem))] -translate-x-1/2 rounded-full border border-white/20 bg-slate-950/95 p-2 shadow-2xl shadow-slate-950/30 backdrop-blur md:block">
        <div className="flex items-center justify-between gap-4 pl-5 text-white">
          <div>
            <p className="text-sm font-black">Transform your Mumbai home today</p>
            <p className="text-xs text-slate-300">Interiors • Modular Kitchen • Wardrobes • Free consultation</p>
          </div>
          <div className="flex gap-2">
            <a href="/estimate">
              <Button className="rounded-full bg-orange-600 font-black hover:bg-orange-700">AI Consultation</Button>
            </a>
            <a href={whatsappUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" className="rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20">WhatsApp</Button>
            </a>
          </div>
        </div>
      </div>
      <a href={whatsappUrl} target="_blank" rel="noreferrer" className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-2xl shadow-emerald-950/30 transition hover:scale-105" aria-label={`WhatsApp ${brand}`}>
        <MessageCircle className="h-7 w-7" />
      </a>
    </>
  );
}

function PopupLead({ open, onClose, onLeadCreated }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-xl">
        <button onClick={onClose} className="absolute -right-2 -top-2 z-10 h-9 w-9 rounded-full bg-white text-lg font-black text-slate-950 shadow-lg">×</button>
        <LeadForm compact onLeadCreated={(lead) => { onLeadCreated?.(lead); setTimeout(onClose, 900); }} />
      </div>
    </div>
  );
}

function VendorRegistrationSection({ services = [] }) {
  const [form, setForm] = useState({
    name: '', phone: '', email: '', cityArea: '', servicesOffered: [],
    yearsExperience: '', teamSize: '', gstPan: '', portfolioNotes: '', website: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const toggleService = (serviceTitle) => {
    setForm((current) => {
      const exists = current.servicesOffered.includes(serviceTitle);
      return {
        ...current,
        servicesOffered: exists
          ? current.servicesOffered.filter((item) => item !== serviceTitle)
          : [...current.servicesOffered, serviceTitle],
      };
    });
  };

  async function submitVendor(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not submit vendor request');
      setMessage(data.message || 'Vendor request submitted.');
      setForm({ name: '', phone: '', email: '', cityArea: '', servicesOffered: [], yearsExperience: '', teamSize: '', gstPan: '', portfolioNotes: '', website: '' });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  const allServices = services.length ? services : [
    { title: 'Residential Interiors' }, { title: 'Commercial Interiors' }, { title: 'Rental Interiors' },
    { title: 'Modular Kitchens' }, { title: 'Modular Wardrobes' }, { title: 'Renovation & Remodeling' },
    { title: 'Turnkey Projects' }, { title: 'Interior Styling' },
  ];

  return (
    <section id="vendor-registration" className="bg-white py-24">
      <div className="container grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <Badge className="mb-4 bg-orange-100 text-orange-700 hover:bg-orange-100">Contractor partnership</Badge>
          <h2 className="text-4xl font-black tracking-tight text-slate-950 md:text-5xl" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Join the {brand} partner network</h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">Interior design, kitchen, wardrobe, and execution teams can partner with us for premium Mumbai projects. Approved partners receive prioritized project assignments.</p>
          <div className="mt-8 grid gap-4">
            {['Mumbai-focused premium interior opportunities', 'Admin review and approval workflow', 'Project assignment for interiors, kitchens & wardrobes'].map((item) => (
              <div key={item} className="flex gap-4 rounded-2xl bg-slate-50 p-4">
                <BadgeCheck className="mt-1 h-5 w-5 flex-none text-orange-600" />
                <p className="font-bold text-slate-800">{item}</p>
              </div>
            ))}
          </div>
        </div>
        <Card className="border-slate-100 shadow-2xl shadow-slate-950/10">
          <CardHeader><CardTitle>Vendor association request</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submitVendor} className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Contractor / company name"><Input value={form.name} onChange={(event) => update('name', event.target.value)} required /></Field>
                <Field label="Phone"><Input value={form.phone} onChange={(event) => update('phone', event.target.value)} required /></Field>
                <Field label="Email"><Input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} /></Field>
                <Field label="City / area"><Input value={form.cityArea} onChange={(event) => update('cityArea', event.target.value)} placeholder="e.g. Andheri, Thane, Navi Mumbai" required /></Field>
                <Field label="Years of experience"><Input type="number" min="0" value={form.yearsExperience} onChange={(event) => update('yearsExperience', event.target.value)} /></Field>
                <Field label="Team size"><Input type="number" min="1" value={form.teamSize} onChange={(event) => update('teamSize', event.target.value)} /></Field>
              </div>
              <Field label="Services offered">
                <div className="grid gap-2 sm:grid-cols-2">
                  {allServices.map((service) => (
                    <label key={service.title} className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm font-bold hover:bg-slate-50">
                      <input type="checkbox" checked={form.servicesOffered.includes(service.title)} onChange={() => toggleService(service.title)} />
                      {service.title}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="GST / PAN optional"><Input value={form.gstPan} onChange={(event) => update('gstPan', event.target.value)} placeholder="Optional" /></Field>
              <Field label="Portfolio notes"><textarea value={form.portfolioNotes} onChange={(event) => update('portfolioNotes', event.target.value)} className="min-h-[100px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Tell us about your experience with painting, kitchens, wardrobes or other services" /></Field>
              <Button disabled={loading} className="bg-orange-600 font-black text-white hover:bg-orange-700 rounded-full">{loading ? 'Submitting...' : 'Request Association'}</Button>
              {message && <p className={`text-sm font-semibold ${message.includes('submitted') ? 'text-emerald-600' : 'text-red-600'}`}>{message}</p>}
              <input type="text" value={form.website} onChange={(event) => update('website', event.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

export default function HomePageClient() {
  const [services, setServices] = useState([]);
  const [projects, setProjects] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [about, setAbout] = useState(null);
  const [rental, setRental] = useState(null);
  const [popupOpen, setPopupOpen] = useState(false);

  async function refreshData() {
    try {
      const [servicesRes, projectsRes, faqsRes, aboutRes, rentalRes] = await Promise.all([
        fetch('/api/services'),
        fetch('/api/projects'),
        fetch('/api/faqs'),
        fetch('/api/about'),
        fetch('/api/rental-interiors'),
      ]);
      const [servicesData, projectsData, faqsData, aboutData, rentalData] = await Promise.all([
        servicesRes.json(),
        projectsRes.json(),
        faqsRes.json(),
        aboutRes.json(),
        rentalRes.json(),
      ]);
      setServices(servicesData.services || []);
      setProjects(projectsData.projects || []);
      setFaqs(faqsData.faqs || []);
      setAbout(aboutData.about || null);
      setRental(rentalData || null);
    } catch (error) {
      console.error('Could not load app data', error);
    }
  }

  useEffect(() => {
    refreshData();
    const timer = setTimeout(() => setPopupOpen(true), 18000);
    return () => clearTimeout(timer);
  }, []);

  function handleLeadCreated() {
    refreshData();
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-slate-950" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <Navbar onQuote={() => setPopupOpen(true)} />
      <Hero onLeadCreated={handleLeadCreated} onQuote={() => setPopupOpen(true)} />
      <Services services={services} />
      <AboutSection about={about} />
      <Testimonials />
      <RentalInteriorsSection rental={rental} />
      <InteriorSolutions />
      <ModularKitchen />
      <Wardrobes />
      <CalculatorSection onLeadCreated={handleLeadCreated} />
      <WhyChoose />
      <HowItWorks />
      <Portfolio projects={projects} />
      <TrustSection />
      <AIFeaturesSection />
      <DashboardPreview />
      <VendorRegistrationSection services={services} />
      <FAQ faqs={faqs} />
      <section className="bg-slate-950 py-24 text-white">
        <div className="container text-center">
          <Badge className="mb-5 bg-orange-500 text-white hover:bg-orange-500">Start your transformation</Badge>
          <h2 className="mx-auto max-w-3xl text-4xl font-black md:text-6xl" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Ready to transform your Mumbai space?
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
            From residential interiors to modular kitchens and wardrobes — book a free consultation and get a digital quotation with no obligation.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a href="/estimate">
              <Button size="lg" className="bg-orange-600 px-8 font-black text-white hover:bg-orange-700 rounded-full">
                Get Instant AI Interior Consultation
              </Button>
            </a>
            <Button onClick={() => setPopupOpen(true)} size="lg" variant="outline" className="border-white/20 bg-white/10 px-8 font-black text-white hover:bg-white/20 rounded-full">Book Free Site Visit</Button>
            <a href={whatsappUrl} target="_blank" rel="noreferrer">
              <Button size="lg" variant="outline" className="border-white/20 bg-white/10 px-8 font-black text-white hover:bg-white/20 rounded-full">
                <MessageCircle className="mr-2 h-5 w-5" /> WhatsApp Now
              </Button>
            </a>
          </div>
        </div>
      </section>
      <Footer />
      <StickyCTA onOpen={() => setPopupOpen(true)} />
      <PopupLead open={popupOpen} onClose={() => setPopupOpen(false)} onLeadCreated={handleLeadCreated} />
    </main>
  );
}
