'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Heart, MessageCircle, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const brands = ['Asian Paints', 'Nerolac', 'Berger', 'Dulux'];
const categories = ['All', 'Whites', 'Beige', 'Grey', 'Blue', 'Luxury', 'Exterior', 'Texture-inspired'];
const whatsappNumber = '917304242604';
const logoUrl = 'https://customer-assets.emergentagent.com/job_paint-modern/artifacts/7r55o0ho_Logo.jpeg';

function trackAnalyticsEvent(eventName, parameters = {}) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', eventName, parameters);
  }
}

function buildWhatsAppUrl(shade) {
  const text = encodeURIComponent(`Hi Brush & Bloom, I am interested in ${shade.brand} shade ${shade.shadeName} (${shade.shadeCode}). Please share painting quotation.`);
  return `https://wa.me/${whatsappNumber}?text=${text}`;
}

function App() {
  const [shades, setShades] = useState([]);
  const [activeBrand, setActiveBrand] = useState('Asian Paints');
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('bb_favorite_shades');
    if (saved) setFavorites(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('bb_favorite_shades', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    async function loadShades() {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('brand', activeBrand);
      if (activeCategory !== 'All') params.set('category', activeCategory);
      if (search.trim()) params.set('search', search.trim());
      try {
        const response = await fetch(`/api/shades?${params.toString()}`);
        const data = await response.json();
        setShades(data.shades || []);
      } catch (error) {
        setShades([]);
      } finally {
        setLoading(false);
      }
    }

    const timer = setTimeout(loadShades, 180);
    return () => clearTimeout(timer);
  }, [activeBrand, activeCategory, search]);

  const favoriteShades = useMemo(() => shades.filter((shade) => favorites.includes(shade.id)), [shades, favorites]);

  function toggleFavorite(id) {
    setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 -z-0 bg-[radial-gradient(circle_at_20%_10%,rgba(249,115,22,0.22),transparent_28%),radial-gradient(circle_at_90%_20%,rgba(59,130,246,0.16),transparent_28%)]" />
      <nav className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/85 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-3">
          <a href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-white p-1"><img src={logoUrl} alt="Brush & Bloom logo" className="h-full w-full object-contain" /></span>
            <span className="text-base font-black tracking-tight sm:text-lg">Brush & Bloom Shades</span>
          </a>
          <a href="/">
            <Button variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20"><ArrowLeft className="mr-2 h-4 w-4" /> Home</Button>
          </a>
        </div>
      </nav>

      <section className="container relative py-14 md:py-20">
        <div className="mx-auto max-w-4xl text-center">
          <Badge className="mb-5 bg-orange-500 text-white hover:bg-orange-500"><Sparkles className="mr-2 h-4 w-4" /> Premium Paint Shade Explorer</Badge>
          <h1 className="text-4xl font-black tracking-tight md:text-7xl">Browse shades. Shortlist colors. Get a painting quote on WhatsApp.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">Explore curated shades from Asian Paints, Nerolac, Berger and Dulux with premium filters for whites, beige, grey, blue, luxury, exterior and texture-inspired finishes.</p>
        </div>

        <Card className="mt-10 border-white/10 bg-white/10 text-white shadow-2xl shadow-black/20 backdrop-blur">
          <CardContent className="p-4 md:p-6">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search shade name or code e.g. Ivory, AP-WH-101" className="h-12 border-white/10 bg-white pl-12 text-slate-950" />
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-300"><SlidersHorizontal className="h-4 w-4 text-orange-300" /> {shades.length} shades visible</div>
            </div>
            <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
              {brands.map((brand) => (
                <Button key={brand} onClick={() => setActiveBrand(brand)} className={`flex-none rounded-full font-black ${activeBrand === brand ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-white/10 text-white hover:bg-white/20'}`}>{brand}</Button>
              ))}
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
              {categories.map((category) => (
                <button key={category} onClick={() => setActiveCategory(category)} className={`flex-none rounded-full border px-4 py-2 text-sm font-bold transition ${activeCategory === category ? 'border-orange-400 bg-orange-500 text-white' : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'}`}>{category}</button>
              ))}
            </div>
          </CardContent>
        </Card>

        {favoriteShades.length > 0 && (
          <div className="mt-8 rounded-3xl border border-orange-400/20 bg-orange-500/10 p-5">
            <p className="font-black text-orange-200">Your shortlist ({favorites.length})</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {favoriteShades.map((shade) => <Badge key={shade.id} className="bg-white text-slate-950 hover:bg-white">{shade.shadeName} · {shade.shadeCode}</Badge>)}
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {loading ? Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-72 animate-pulse rounded-3xl bg-white/10" />) : shades.map((shade) => (
            <Card key={shade.id} className="group overflow-hidden border-white/10 bg-white/10 text-white shadow-xl shadow-black/10 backdrop-blur transition duration-300 hover:-translate-y-2 hover:bg-white/[0.14]">
              <div className="h-36 border-b border-white/10" style={{ backgroundColor: shade.hexColor }} />
              <CardContent className="p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-300">{shade.brand}</p>
                    <h3 className="mt-1 text-xl font-black">{shade.shadeName}</h3>
                  </div>
                  <button onClick={() => toggleFavorite(shade.id)} className={`flex h-10 w-10 items-center justify-center rounded-full border border-white/10 ${favorites.includes(shade.id) ? 'bg-orange-500 text-white' : 'bg-white/10 text-slate-200'}`} aria-label="Favorite shade">
                    <Heart className={`h-5 w-5 ${favorites.includes(shade.id) ? 'fill-current' : ''}`} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-white/10 text-white hover:bg-white/10">{shade.shadeCode}</Badge>
                  <Badge className="bg-orange-500/20 text-orange-100 hover:bg-orange-500/20">{shade.category}</Badge>
                  <Badge className="bg-white/10 text-white hover:bg-white/10">{shade.hexColor}</Badge>
                </div>
                <a href={buildWhatsAppUrl(shade)} target="_blank" rel="noreferrer" onClick={() => trackAnalyticsEvent('whatsapp_click', { event_category: 'engagement', event_label: 'Shade enquiry WhatsApp', brand: shade.brand, shade_code: shade.shadeCode })}>
                  <Button className="mt-5 w-full bg-emerald-600 font-black text-white hover:bg-emerald-700"><MessageCircle className="mr-2 h-4 w-4" /> Enquire on WhatsApp</Button>
                </a>
              </CardContent>
            </Card>
          ))}
        </div>

        {!loading && shades.length === 0 && (
          <div className="mt-10 rounded-3xl border border-dashed border-white/15 p-10 text-center">
            <p className="text-2xl font-black">No shades found</p>
            <p className="mt-2 text-slate-400">Try a different brand, category or shade code.</p>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
