'use client';

import MetaGalleryImage from '@/components/meta-landing/MetaGalleryImage';
import type { PaintingGalleryItem } from '@/lib/painting/types';

type PaintingGalleryProps = {
  items: PaintingGalleryItem[];
};

function GalleryCard({ item, priority = false }: { item: PaintingGalleryItem; priority?: boolean }) {
  return (
    <article className="painting-card group relative aspect-[4/3] overflow-hidden">
      <MetaGalleryImage
        src={item.imageUrl}
        alt={item.title}
        fill
        priority={priority}
        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        sizes="(max-width: 768px) 85vw, (max-width: 1200px) 45vw, 33vw"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-5">
        <p className="font-semibold text-white">{item.title}</p>
        {item.category ? (
          <p className="mt-1 text-xs font-medium uppercase tracking-wider text-orange-200">{item.category}</p>
        ) : null}
      </div>
    </article>
  );
}

export default function PaintingGallery({ items = [] }: PaintingGalleryProps) {
  return (
    <section className="bg-white py-16 md:py-24" aria-labelledby="painting-gallery-heading">
      <div className="container mb-10 md:mb-12">
        <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Our Work</p>
        <h2
          id="painting-gallery-heading"
          className="mt-3 text-center text-3xl font-bold text-slate-900 md:text-4xl"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          Painting Project Gallery
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-7 text-slate-500">
          Real painting projects across Mumbai — managed and updated from admin.
        </p>
      </div>

      {!items.length ? (
        <div className="container">
          <div className="painting-card px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-500">
              Gallery projects will appear here once published in the Painting admin panel.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="container hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {items.map((item, index) => (
              <GalleryCard key={item.id} item={item} priority={index < 2} />
            ))}
          </div>
          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.map((item, index) => (
              <div key={item.id} className="w-[85vw] max-w-sm flex-none snap-center">
                <GalleryCard item={item} priority={index === 0} />
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
