'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Play, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

function SectionHeader({ eyebrow, title, text, light = false }) {
  return (
    <div className="mx-auto mb-10 max-w-3xl text-center">
      <Badge className={`mb-4 ${light ? 'bg-white/20 text-white hover:bg-white/20 border border-white/30' : 'bg-orange-100 text-orange-700 hover:bg-orange-100'}`}>{eyebrow}</Badge>
      <h2 className={`text-3xl font-black tracking-tight md:text-5xl ${light ? 'text-white' : 'text-slate-950'}`} style={{ fontFamily: "'Cormorant Garamond', serif" }}>{title}</h2>
      <p className={`mt-4 text-base leading-7 md:text-lg ${light ? 'text-slate-300' : 'text-slate-600'}`}>{text}</p>
    </div>
  );
}

function Lightbox({ item, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm" onClick={onClose}>
      <button onClick={onClose} className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg font-black text-slate-950 shadow-lg" aria-label="Close">
        <X className="h-5 w-5" />
      </button>
      <div className="relative max-h-[90vh] max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
        {item.mediaType === 'video' && item.videoUrl ? (
          <video src={item.videoUrl} controls autoPlay className="max-h-[85vh] w-full rounded-2xl bg-black" poster={item.thumbnailUrl || item.imageUrl} />
        ) : (
          <img src={item.imageUrl || item.thumbnailUrl} alt={item.title} className="max-h-[85vh] w-full rounded-2xl object-contain" />
        )}
        <div className="mt-4 text-center text-white">
          <h3 className="text-xl font-black">{item.title}</h3>
          {item.description && <p className="mt-2 text-sm text-slate-300">{item.description}</p>}
        </div>
      </div>
    </div>
  );
}

export default function GalleryViewer({
  items = [],
  categories = [],
  featuredOnly = false,
  showViewAllLink = false,
  sectionId = 'projects',
  eyebrow = 'Project showcase',
  title = 'Premium transformations across Mumbai',
  subtitle = 'Residential, commercial, rental and modular interior projects from our portfolio.',
}) {
  const [activeFilter, setActiveFilter] = useState('All');
  const [lightboxItem, setLightboxItem] = useState(null);

  const categoryNames = categories.length
    ? ['All', ...categories.map((c) => c.name)]
    : ['All', ...new Set(items.map((i) => i.category).filter(Boolean))];

  const filtered = activeFilter === 'All'
    ? items
    : items.filter((p) => p.category === activeFilter || p.categoryId === activeFilter);

  const displayItems = filtered.length ? filtered : items;

  const openLightbox = useCallback((item) => setLightboxItem(item), []);
  const closeLightbox = useCallback(() => setLightboxItem(null), []);

  if (!items.length) return null;

  return (
    <>
      <section id={sectionId} className="bg-white py-24">
        <div className="container">
          <SectionHeader eyebrow={eyebrow} title={title} text={subtitle} />

          {!featuredOnly && categoryNames.length > 1 && (
            <div className="mb-8 flex flex-wrap justify-center gap-2">
              {categoryNames.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveFilter(cat)}
                  className={`rounded-full px-5 py-2 text-sm font-bold transition ${activeFilter === cat ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            {displayItems.map((project) => (
              <Card key={project.id} className="overflow-hidden border-0 shadow-xl shadow-slate-950/10 group cursor-pointer" onClick={() => openLightbox(project)}>
                <div className="relative h-72 overflow-hidden">
                  <img
                    src={project.image || project.thumbnailUrl || project.imageUrl}
                    alt={project.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  {project.mediaType === 'video' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-orange-600 shadow-lg">
                        <Play className="h-6 w-6 fill-current" />
                      </div>
                    </div>
                  )}
                  <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-slate-950 backdrop-blur">{project.category}</div>
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <CardContent className="p-6">
                  <h3 className="text-xl font-black text-slate-950">{project.title}</h3>
                  {(project.location || project.duration) && (
                    <p className="mt-1 text-sm text-slate-500">{[project.location, project.duration].filter(Boolean).join(' • ')}</p>
                  )}
                  <p className="mt-4 text-sm leading-6 text-slate-600">{project.result || project.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {showViewAllLink && (
            <div className="mt-10 text-center">
              <a href="/gallery" className="inline-flex items-center rounded-full bg-orange-600 px-8 py-3 text-sm font-black text-white hover:bg-orange-700 transition-colors">
                View full gallery <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </div>
          )}
        </div>
      </section>
      {lightboxItem && <Lightbox item={lightboxItem} onClose={closeLightbox} />}
    </>
  );
}
