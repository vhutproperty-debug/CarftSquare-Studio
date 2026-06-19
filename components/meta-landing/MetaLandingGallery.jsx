'use client';

import MetaGalleryImage from '@/components/meta-landing/MetaGalleryImage';

function GalleryCard({ item, priority = false }) {
  return (
    <article className="meta-gallery-card group relative aspect-[4/3] w-full shrink-0 snap-center overflow-hidden rounded-2xl bg-[#1a1a1c] shadow-[0_8px_30px_rgba(0,0,0,0.35)] md:snap-align-none">
      <MetaGalleryImage
        src={item.image}
        alt={item.title}
        fill
        priority={priority}
        className="object-cover transition-transform duration-500 ease-out will-change-transform group-hover:scale-[1.03]"
        sizes="(max-width: 768px) 85vw, (max-width: 1200px) 45vw, 33vw"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0F0F10]/90 via-[#0F0F10]/20 to-transparent opacity-70 transition-opacity duration-300 group-hover:opacity-95"
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 opacity-0 transition-all duration-300 group-hover:opacity-100">
        <p className="text-base font-bold tracking-wide text-[#FAF8F5]">{item.title}</p>
        {item.category ? (
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-orange-300/90">{item.category}</p>
        ) : null}
      </div>
    </article>
  );
}

export default function MetaLandingGallery({ items = [] }) {
  return (
    <section className="meta-gallery-section overflow-hidden bg-[#0F0F10] py-16 md:py-24">
      <div className="container mb-10 md:mb-12">
        <p className="text-center text-xs font-bold uppercase tracking-[0.22em] text-orange-400/90">Portfolio</p>
        <h2
          className="mt-3 text-center text-3xl font-black text-[#FAF8F5] md:text-4xl"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          Premium Project Gallery
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-7 text-slate-400">
          Real interiors delivered across Mumbai — curated from our live project portfolio.
        </p>
      </div>

      {!items.length ? (
        <div className="container">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-12 text-center backdrop-blur-sm">
            <p className="text-sm font-semibold text-slate-300">Gallery projects will appear here once published in admin.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="hidden gap-4 px-4 md:grid md:grid-cols-2 md:px-6 lg:grid-cols-3 lg:px-8 lg:gap-5">
            {items.map((item, index) => (
              <GalleryCard key={item.id} item={item} priority={index < 2} />
            ))}
          </div>

          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.map((item, index) => (
              <div key={item.id} className="w-[85vw] max-w-sm flex-none">
                <GalleryCard item={item} priority={index === 0} />
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
