'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  Droplets,
  Download,
  Eye,
  FileText,
  Hammer,
  Home,
  ImageIcon,
  Layers,
  LockKeyhole,
  LogOut,
  MessageCircle,
  Paintbrush,
  Palette,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Upload,
  Users,
  WalletCards,
  Wand2,
  ChefHat,
  Sofa,
  Lightbulb,
  Grid3X3,
  Maximize2,
  Layout,
  Package,
  Zap,
  Award,
  TrendingUp,
  Bot,
  Camera,
  Calculator,
  Brain,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { BRAND, absoluteLogoUrl, whatsappUrl } from '@/lib/brand';
import AboutSection from '@/components/AboutSection';
import BrandLogo from '@/components/BrandLogo';
import GalleryViewer from '@/components/GalleryViewer';

const brand = BRAND.name;
const whatsappNumber = BRAND.whatsappNumber;

const iconMap = {
  Paintbrush,
  Building2,
  ShieldCheck,
  Sparkles,
  Home,
  Hammer,
  BadgeCheck,
  Layers,
};

const trustStats = [
  { label: 'Mumbai spaces transformed', value: '850+', icon: Home },
  { label: 'Average rating', value: '4.9/5', icon: Star },
  { label: 'Warranty-backed projects', value: '5 Year+', icon: ShieldCheck },
  { label: 'Consultation booking time', value: '30 sec', icon: Clock },
];

const whyChoose = [
  { title: 'Design-to-Execution', text: 'Single team handles design, modular work, furniture and final styling.', icon: Users },
  { title: 'Premium Materials', text: 'Curated materials and hardware from trusted global and Indian brands.', icon: BadgeCheck },
  { title: 'Dedicated Manager', text: 'One project owner for quote, schedule, execution and handover.', icon: CalendarClock },
  { title: 'Digital Quotation', text: 'Transparent scope, material recommendation and timeline in writing.', icon: FileText },
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

const brandLogos = ['Hettich', 'Hafele', 'Greenlam', 'Merino', 'Century Ply', 'Ebco'];

const albumShowcases = [
  {
    title: 'Professional Home Services Mumbai',
    subtitle: 'Before/after painting, waterproofing, deep cleaning and real project finish gallery.',
    url: 'https://customer-assets.emergentagent.com/job_paint-modern/artifacts/kz3t746n_brush_bloom_album.html',
    tags: ['Before & After', 'Painting', 'Waterproofing', 'Deep Cleaning'],
  },
  {
    title: 'Designer Texture & Wall Finishes',
    subtitle: 'Venetian plaster, metallic finish, stencil art, palm weave and luxury texture portfolio.',
    url: 'https://customer-assets.emergentagent.com/job_paint-modern/artifacts/cilogo07_brush_bloom_textures_album2.html',
    tags: ['Textures', 'Venetian', 'Metallic', 'Stencil Art'],
  },
];

const testimonials = [
  {
    name: 'Rhea Shah',
    area: 'Bandra West',
    text: 'CraftSquare Studio transformed our 2BHK with a stunning modular kitchen and custom wardrobes. The design-to-execution process was seamless.',
  },
  {
    name: 'Amit Menon',
    area: 'Andheri',
    text: 'Booked rental interior furnishing for our investment property. Professional execution, transparent pricing and tenant-ready delivery.',
  },
  {
    name: 'Neha & Karan',
    area: 'Powai',
    text: 'Premium finishes, dedicated project manager and daily updates. Our complete home transformation exceeded expectations.',
  },
  {
    name: 'Priya Kapoor',
    area: 'Juhu',
    text: 'CraftSquare Studio handled our complete 3BHK interior — modular kitchen, wardrobes and styling. One point of contact made it stress-free.',
  },
];

const defaultLead = {
  name: '',
  phone: '',
  location: '',
  service: 'residential-interiors',
  propertyType: 'apartment',
  bhk: '2BHK',
  area: 750,
  paintQuality: 'premium',
  projectType: 'repaint',
  preferredSlot: 'Today / Tomorrow',
  notes: '',
  website: '',
};

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
  { title: 'AI Room Visualizer', desc: 'Upload your room photo and preview interior designs instantly before committing. Powered by AI.', icon: Camera, status: 'Coming Soon' },
  { title: 'AI Quotation Assistant', desc: 'Chat-based intelligent quote builder for interiors, kitchens, and wardrobes in seconds.', icon: Bot, status: 'Coming Soon' },
  { title: 'Smart Project Estimator', desc: 'Upload floor plan or enter dimensions for instant interior project cost estimate.', icon: Calculator, status: 'Coming Soon' },
  { title: 'Renovation Recommender', desc: 'AI-powered renovation priority suggestions based on your home type, age and budget.', icon: Brain, status: 'Coming Soon' },
];

function trackAnalyticsEvent(eventName, parameters = {}) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', eventName, parameters);
  }
}

function formatCurrency(value = 0) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function Field({ label, children }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</Label>
      {children}
    </div>
  );
}

function SelectField({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
    >
      {children}
    </select>
  );
}

function SectionHeader({ eyebrow, title, text, light = false }) {
  return (
    <div className="mx-auto mb-10 max-w-3xl text-center">
      <Badge className={`mb-4 ${light ? 'bg-white/20 text-white hover:bg-white/20 border border-white/30' : 'bg-orange-100 text-orange-700 hover:bg-orange-100'}`}>{eyebrow}</Badge>
      <h2 className={`text-3xl font-black tracking-tight md:text-5xl ${light ? 'text-white' : 'text-slate-950'}`} style={{ fontFamily: "'Cormorant Garamond', serif" }}>{title}</h2>
      <p className={`mt-4 text-base leading-7 md:text-lg ${light ? 'text-slate-300' : 'text-slate-600'}`}>{text}</p>
    </div>
  );
}

function LeadForm({ compact = false, onLeadCreated }) {
  const [form, setForm] = useState(defaultLead);
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function calculate() {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not calculate estimate');
      setEstimate(data.estimate);
      return data.estimate;
    } catch (error) {
      setMessage(error.message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function submitLead(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const currentEstimate = estimate || await calculate();
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, estimate: currentEstimate, source: compact ? 'sticky_popup' : 'homepage' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not submit lead');
      setMessage(data.message || 'Inspection booked.');
      trackAnalyticsEvent('generate_lead', {
        event_category: 'conversion',
        event_label: 'Lead form submission',
        service: form.service,
        source: compact ? 'sticky_popup' : 'homepage',
      });
      setForm((current) => ({ ...defaultLead, phone: current.phone }));
      setEstimate(data.lead?.estimate || currentEstimate);
      onLeadCreated?.(data.lead);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="overflow-hidden border-0 bg-white/95 shadow-2xl shadow-orange-950/15 backdrop-blur">
      <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-950 to-slate-800 text-white">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-black">Book Free Consultation</CardTitle>
            <p className="mt-1 text-sm text-slate-300">Complete Interior Solutions • Mumbai</p>
          </div>
          <Badge className="bg-orange-500 text-white hover:bg-orange-500">30 sec</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        <form onSubmit={submitLead} className="grid gap-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Name">
              <Input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Your name" required />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="Mumbai mobile number" required />
            </Field>
          </div>
          <Field label="Area / Society">
            <Input value={form.location} onChange={(event) => update('location', event.target.value)} placeholder="e.g. Bandra, Powai, Andheri" />
          </Field>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Service">
              <SelectField value={form.service} onChange={(value) => update('service', value)}>
                <optgroup label="Interior Services">
                  <option value="residential-interiors">Residential Interiors</option>
                  <option value="commercial-interiors">Commercial Interiors</option>
                  <option value="rental-interiors">Rental Furnishing</option>
                  <option value="modular-kitchens">Modular Kitchens</option>
                  <option value="modular-wardrobes">Modular Wardrobes</option>
                  <option value="renovation-remodeling">Renovation & Remodeling</option>
                  <option value="turnkey-projects">Turnkey Projects</option>
                </optgroup>
                <optgroup label="Design Services">
                  <option value="space-planning">Space Planning</option>
                  <option value="interior-styling">Interior Styling</option>
                  <option value="design-consultation">Design Consultation</option>
                </optgroup>
              </SelectField>
            </Field>
            <Field label="Carpet area (sq.ft)">
              <Input type="number" value={form.area} onChange={(event) => update('area', event.target.value)} min="150" />
            </Field>
            {!compact && (
              <>
                <Field label="BHK">
                  <SelectField value={form.bhk} onChange={(value) => update('bhk', value)}>
                    <option>1BHK</option>
                    <option>2BHK</option>
                    <option>3BHK</option>
                    <option>4BHK+</option>
                    <option>Villa</option>
                    <option>Commercial</option>
                  </SelectField>
                </Field>
                <Field label="Finish level">
                  <SelectField value={form.paintQuality} onChange={(value) => update('paintQuality', value)}>
                    <option value="economy">Economy</option>
                    <option value="standard">Standard</option>
                    <option value="premium">Premium</option>
                    <option value="luxury">Luxury</option>
                  </SelectField>
                </Field>
              </>
            )}
          </div>
          {!compact && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Project type">
                <SelectField value={form.projectType} onChange={(value) => update('projectType', value)}>
                  <option value="repaint">Renovation / Upgrade</option>
                  <option value="fresh">New / Fresh Project</option>
                </SelectField>
              </Field>
              <Field label="Consultation slot">
                <SelectField value={form.preferredSlot} onChange={(value) => update('preferredSlot', value)}>
                  <option>Today / Tomorrow</option>
                  <option>This Weekend</option>
                  <option>Next Week</option>
                </SelectField>
              </Field>
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" variant="outline" onClick={calculate} disabled={loading} className="border-orange-200 font-bold text-orange-700 hover:bg-orange-50">
              Calculate Cost
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 bg-orange-600 font-black text-white hover:bg-orange-700">
              {loading ? 'Working...' : 'Get Free Quote'} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          {estimate && (
            <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-700">Instant estimate</p>
              <p className="mt-1 text-3xl font-black text-slate-950">{estimate.formattedRange}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-600">
                <span>Material: <b>{formatCurrency(estimate.materialEstimate)}</b></span>
                <span>Labor: <b>{formatCurrency(estimate.laborEstimate)}</b></span>
                <span>Timeline: <b>{estimate.timelineDays} days</b></span>
              </div>
              <p className="mt-3 text-sm text-slate-700">{estimate.recommendation}</p>
            </div>
          )}
          {message && <p className={`text-sm font-semibold ${message.includes('Thank you') || message.includes('captured') || message.includes('booked') ? 'text-emerald-600' : 'text-red-600'}`}>{message}</p>}
          <input type="text" value={form.website} onChange={(event) => update('website', event.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
        </form>
      </CardContent>
    </Card>
  );
}

function Navbar({ onQuote }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const navLinks = [
    { label: 'Services', href: '#services' },
    { label: 'About', href: '#about' },
    { label: 'Interiors', href: '#interiors' },
    { label: 'Modular Kitchen', href: '#modular-kitchen' },
    { label: 'Wardrobes', href: '#wardrobes' },
    { label: 'Projects', href: '#projects' },
  ];

  return (
    <>
      <nav className={`fixed left-0 right-0 top-0 z-40 transition-all duration-300 ${scrolled ? 'border-b border-white/10 bg-slate-950/95 backdrop-blur-xl shadow-lg' : 'bg-slate-950/80 backdrop-blur-xl'}`}>
        <div className="container flex h-16 items-center justify-between gap-3">
          <a href="#" className="flex items-center">
            <BrandLogo variant="nav" />
          </a>
          <div className="hidden items-center gap-5 text-sm font-semibold text-slate-300 lg:flex">
            {navLinks.map((link) => (
              <a key={link.label} href={link.href} className="hover:text-white transition-colors">{link.label}</a>
            ))}
            <a href="/gallery" className="hover:text-white transition-colors">Gallery</a>
            <a href="/rental-interiors" className="hover:text-white transition-colors">Rental Furnishing</a>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onQuote}
              className="hidden rounded-full bg-orange-600 px-5 py-2 text-sm font-black text-white hover:bg-orange-700 transition-colors sm:block"
            >
              Get Quote
            </button>
            <a href={whatsappUrl} target="_blank" rel="noreferrer">
              <Button className="bg-emerald-600 px-3 font-bold text-white hover:bg-emerald-700 rounded-full sm:px-4">
                <MessageCircle className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">WhatsApp</span>
              </Button>
            </a>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white lg:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              <span className="text-lg">{mobileOpen ? '×' : '☰'}</span>
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="border-t border-white/10 bg-slate-950/98 px-4 pb-4 lg:hidden">
            {navLinks.map((link) => (
              <a key={link.label} href={link.href} className="block py-3 text-sm font-semibold text-slate-300 hover:text-white" onClick={() => setMobileOpen(false)}>
                {link.label}
              </a>
            ))}
          </div>
        )}
      </nav>
    </>
  );
}

function Hero({ onLeadCreated, onQuote }) {
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

          {/* Service pills */}
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

function ServicesSection({ services = [] }) {
  return (
    <section id="services" className="bg-white py-24">
      <div className="container">
        <SectionHeader
          eyebrow="Our Services"
          title="Complete interior solutions for every space"
          text="From residential and commercial interiors to modular kitchens, wardrobes and rental furnishing — design-to-execution under one roof."
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((service) => {
            const Icon = iconMap[service.icon] || Sparkles;
            return (
              <Card key={service.id} className="group border-slate-100 bg-white transition duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-orange-950/10">
                <CardContent className="p-6">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-700 transition group-hover:scale-110 group-hover:bg-orange-600 group-hover:text-white">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-black text-slate-950">{service.title}</h3>
                  <p className="mt-2 text-sm font-bold text-orange-600">{service.price}</p>
                  <p className="mt-3 min-h-[72px] text-sm leading-6 text-slate-600">{service.description}</p>
                  <a href={`/services/${service.slug || service.id}`} className="mt-5 inline-flex items-center text-sm font-black text-slate-950">
                    Learn more <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

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

        {/* Kitchen types */}
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

        {/* Material comparison */}
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
          <div className="mt-8 text-center">
            <a href="#quote">
              <Button className="bg-orange-600 font-black text-white hover:bg-orange-700 rounded-full px-8">
                Get Kitchen Design Quote <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
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
                  <a href="#quote" className="mt-5 inline-flex items-center text-sm font-black text-slate-950">
                    Get wardrobe quote <ArrowRight className="ml-2 h-4 w-4" />
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
        <div className="mt-10 text-center">
          <a href="/rental-interiors" className="inline-flex items-center rounded-full bg-orange-600 px-8 py-3 text-sm font-black text-white hover:bg-orange-700">
            Explore Rental Furnishing <ArrowRight className="ml-2 h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}

function ProjectsGallery({ projects = [] }) {
  return (
    <GalleryViewer
      items={projects}
      featuredOnly
      showViewAllLink
      sectionId="projects"
      eyebrow="Project showcase"
      title="Premium interior transformations across Mumbai"
      subtitle="Featured residential, commercial, rental and modular projects from our portfolio."
    />
  );
}

function AlbumGallerySection() {
  return (
    <section id="work-albums" className="bg-slate-50 py-24">
      <div className="container">
        <SectionHeader eyebrow="Real project gallery" title="Project albums for painting, interiors & designer finishes" text="Explore our uploaded Brush & Bloom albums for full-size project visuals across painting, cleaning, kitchens and textures." />
        <div className="grid gap-6 lg:grid-cols-2">
          {albumShowcases.map((album) => (
            <Card key={album.title} className="overflow-hidden border-0 bg-white shadow-2xl shadow-slate-950/10">
              <div className="relative h-72 overflow-hidden bg-slate-950 md:h-80">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(249,115,22,0.42),transparent_28%),radial-gradient(circle_at_85%_10%,rgba(255,255,255,0.16),transparent_26%)]" />
                <div className="absolute inset-6 rounded-[2rem] border border-white/10 bg-white/10 p-6 text-white backdrop-blur">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500"><Paintbrush className="h-7 w-7" /></div>
                  <p className="mt-8 text-xs font-black uppercase tracking-[0.24em] text-orange-200">Brush & Bloom Album</p>
                  <h3 className="mt-3 max-w-sm text-3xl font-black leading-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{album.title}</h3>
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950/80 to-transparent" />
              </div>
              <CardContent className="p-6">
                <div className="flex flex-wrap gap-2">
                  {album.tags.map((tag) => <Badge key={tag} className="bg-orange-100 text-orange-700 hover:bg-orange-100">{tag}</Badge>)}
                </div>
                <h3 className="mt-4 text-2xl font-black text-slate-950">{album.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{album.subtitle}</p>
                <a href={album.url} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center text-sm font-black text-orange-700">
                  Open full album <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsAndBrands() {
  return (
    <section className="bg-white py-24">
      <div className="container">
        <SectionHeader eyebrow="Customer trust" title="What Mumbai homeowners say about us" text={`Real reviews from clients who transformed their spaces with ${brand}'s complete interior solutions.`} />
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="grid gap-4 sm:grid-cols-2">
            {testimonials.map((review) => (
              <Card key={review.name} className="border-slate-100 transition hover:shadow-lg">
                <CardContent className="p-5">
                  <div className="flex gap-1 text-orange-500">{Array.from({ length: 5 }).map((_, index) => <Star key={index} className="h-4 w-4 fill-current" />)}</div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">"{review.text}"</p>
                  <p className="mt-4 font-black text-slate-950">{review.name}</p>
                  <p className="text-sm text-slate-500">{review.area}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="border-0 bg-slate-950 text-white shadow-2xl shadow-slate-950/20">
            <CardContent className="p-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-orange-500"><Droplets className="h-8 w-8" /></div>
              <h3 className="mt-8 text-3xl font-black" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Premium brands we partner with</h3>
              <p className="mt-3 text-slate-300">Material and hardware recommendations selected after design consultation, budget and project requirements.</p>
              <div className="mt-8 grid grid-cols-2 gap-3">
                {brandLogos.map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/10 p-4 text-center font-black backdrop-blur">{item}</div>
                ))}
              </div>
              <div className="mt-8 rounded-2xl bg-white p-5 text-slate-950">
                <p className="text-sm font-bold text-slate-500">Complete workflow guarantee</p>
                <p className="mt-1 text-xl font-black">Quote → Execution → QC → Warranty</p>
              </div>
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
            return (
              <Card key={feature.title} className="border-white/10 bg-white/5 backdrop-blur transition hover:bg-white/10">
                <CardContent className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/20 text-orange-300">
                      <Icon className="h-6 w-6" />
                    </div>
                    <Badge className="bg-white/10 text-slate-300 border-white/20 text-xs">{feature.status}</Badge>
                  </div>
                  <h3 className="text-base font-black text-white">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{feature.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <div className="mt-8 text-center">
          <p className="text-slate-400 text-sm">Be the first to access these features</p>
          <a href={whatsappUrl} target="_blank" rel="noreferrer">
            <Button className="mt-4 bg-orange-600 font-black text-white hover:bg-orange-700 rounded-full px-8">
              <MessageCircle className="mr-2 h-4 w-4" /> Join the waitlist on WhatsApp
            </Button>
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
              <p className="text-orange-100">Transparent digital quotes. No hidden charges. What's quoted is what's billed.</p>
            </CardContent>
          </Card>
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

function FAQ({ faqs = [] }) {
  return (
    <section className="bg-slate-50 py-24">
      <div className="container max-w-4xl">
        <SectionHeader eyebrow="FAQ" title="Mumbai home transformation questions answered" text="Fast answers to the highest-converting buyer objections before booking inspection." />
        <div className="space-y-4">
          {faqs.map((faq) => (
            <Card key={faq.q} className="border-slate-100 bg-white transition hover:shadow-md">
              <CardContent className="p-6">
                <h3 className="font-black text-slate-950">{faq.q}</h3>
                <p className="mt-2 leading-7 text-slate-600">{faq.a}</p>
              </CardContent>
            </Card>
          ))}
        </div>
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
            <Button onClick={onOpen} className="rounded-full bg-orange-600 font-black hover:bg-orange-700">Get Quote</Button>
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

function App() {
  const [services, setServices] = useState([]);
  const [projects, setProjects] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [about, setAbout] = useState(null);
  const [rental, setRental] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [leads, setLeads] = useState([]);
  const [popupOpen, setPopupOpen] = useState(false);

  const schema = useMemo(() => ({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: brand,
    image: absoluteLogoUrl,
    telephone: BRAND.phone,
    areaServed: 'Mumbai',
    address: { '@type': 'PostalAddress', addressLocality: 'Mumbai', addressCountry: 'IN' },
    priceRange: '₹₹₹',
    aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.9', reviewCount: '850' },
    makesOffer: [
      'Interior Design Mumbai', 'Residential Interiors Mumbai', 'Commercial Interiors Mumbai',
      'Rental Interiors Mumbai', 'Modular Kitchen Mumbai', 'Wardrobe Design Mumbai',
      'Turnkey Interiors Mumbai', 'Home Renovation Mumbai', 'Interior Styling Mumbai',
      'Interior Designer Malad', 'Modular Kitchen Kandivali', 'Rental Interiors Borivali',
    ],
  }), []);

  async function refreshData() {
    try {
      const [servicesRes, projectsRes, faqsRes, aboutRes, rentalRes, dashboardRes, leadsRes] = await Promise.all([
        fetch('/api/services'),
        fetch('/api/projects'),
        fetch('/api/faqs'),
        fetch('/api/about'),
        fetch('/api/rental-interiors'),
        fetch('/api/dashboard'),
        fetch('/api/leads'),
      ]);
      const [servicesData, projectsData, faqsData, aboutData, rentalData, dashboardData, leadsData] = await Promise.all([
        servicesRes.json(),
        projectsRes.json(),
        faqsRes.json(),
        aboutRes.json(),
        rentalRes.json(),
        dashboardRes.json(),
        leadsRes.json(),
      ]);
      setServices(servicesData.services || []);
      setProjects(projectsData.projects || []);
      setFaqs(faqsData.faqs || []);
      setAbout(aboutData.about || null);
      setRental(rentalData || null);
      setDashboard(dashboardData || null);
      setLeads(leadsData.leads || []);
    } catch (error) {
      console.error('Could not load app data', error);
    }
  }

  useEffect(() => {
    refreshData();
    const timer = setTimeout(() => setPopupOpen(true), 18000);
    return () => clearTimeout(timer);
  }, []);

  function handleLeadCreated(lead) {
    if (lead) {
      setLeads((current) => [lead, ...current.filter((item) => item.id !== lead.id)]);
    }
    refreshData();
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-slate-950" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <Navbar onQuote={() => setPopupOpen(true)} />
      <Hero onLeadCreated={handleLeadCreated} onQuote={() => setPopupOpen(true)} />
      <ServicesSection services={services} />
      <AboutSection about={about} />
      <RentalInteriorsSection rental={rental} />
      <InteriorSolutions />
      <ModularKitchen />
      <Wardrobes />
      <CalculatorSection onLeadCreated={handleLeadCreated} />
      <WhyChoose />
      <HowItWorks />
      <ProjectsGallery projects={projects} />
      <TestimonialsAndBrands />
      <TrustSection />
      <AIFeaturesSection />
      <DashboardPreview leads={leads} dashboard={dashboard} />
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
            <Button onClick={() => setPopupOpen(true)} size="lg" className="bg-orange-600 px-8 font-black text-white hover:bg-orange-700 rounded-full">Book Free Site Visit</Button>
            <button onClick={() => setPopupOpen(true)} className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-8 py-3 text-base font-black text-white hover:bg-white/20 transition-colors">
              Get Instant Estimate
            </button>
            <a href={whatsappUrl} target="_blank" rel="noreferrer">
              <Button size="lg" variant="outline" className="border-white/20 bg-white/10 px-8 font-black text-white hover:bg-white/20 rounded-full">
                <MessageCircle className="mr-2 h-5 w-5" /> WhatsApp Now
              </Button>
            </a>
          </div>
        </div>
      </section>
      <footer className="bg-white py-12">
        <div className="container">
          <div className="grid gap-8 md:grid-cols-4 mb-8">
            <div>
              <div className="mb-4">
                <BrandLogo variant="footer" />
              </div>
              <p className="text-sm text-slate-500">Premium interior design and complete interior solutions. Mumbai&apos;s trusted design-to-execution partner.</p>
            </div>
            <div>
              <h4 className="font-black text-slate-950 mb-3">Services</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><a href="#services" className="hover:text-orange-600">Interior Services</a></li>
                <li><a href="/rental-interiors" className="hover:text-orange-600">Rental Furnishing</a></li>
                <li><a href="#modular-kitchen" className="hover:text-orange-600">Modular Kitchen</a></li>
                <li><a href="#wardrobes" className="hover:text-orange-600">Wardrobes</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-black text-slate-950 mb-3">Company</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><a href="/about" className="hover:text-orange-600">About Us</a></li>
                <li><a href="/gallery" className="hover:text-orange-600">Gallery</a></li>
                <li><a href="#projects" className="hover:text-orange-600">Projects</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-black text-slate-950 mb-3">Contact</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><a href="tel:+917304242604" className="hover:text-orange-600">+91 73042 42604</a></li>
                <li><a href={whatsappUrl} target="_blank" rel="noreferrer" className="hover:text-orange-600">WhatsApp</a></li>
                <li><a href="/admin" className="hover:text-orange-600">Admin Portal</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-6 flex flex-col gap-2 md:flex-row md:justify-between text-xs text-slate-400">
            <p>© 2025 {brand}. Premium interior design & solutions in Mumbai.</p>
            <p>Interior Design Mumbai • Modular Kitchen Mumbai • Rental Interiors Mumbai • Turnkey Interiors Mumbai</p>
          </div>
        </div>
      </footer>
      <StickyCTA onOpen={() => setPopupOpen(true)} />
      <PopupLead open={popupOpen} onClose={() => setPopupOpen(false)} onLeadCreated={handleLeadCreated} />
    </main>
  );
}

export default App;
