'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

type TestimonialCard = {
  id: string;
  name: string;
  location: string;
  rating: number;
  text: string;
  projectType: string;
};

type PaintingTestimonialsProps = {
  testimonials: TestimonialCard[];
};

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

export default function PaintingTestimonials({ testimonials = [] }: PaintingTestimonialsProps) {
  const [index, setIndex] = useState(0);
  const items = testimonials.length ? testimonials : [];

  const goNext = useCallback(() => {
    if (!items.length) return;
    setIndex((current) => (current + 1) % items.length);
  }, [items.length]);

  const goPrev = useCallback(() => {
    if (!items.length) return;
    setIndex((current) => (current - 1 + items.length) % items.length);
  }, [items.length]);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = window.setInterval(goNext, 6000);
    return () => window.clearInterval(timer);
  }, [goNext, items.length]);

  if (!items.length) return null;

  const current = items[index];

  return (
    <section className="bg-[#f5f5f7] py-16 md:py-24" aria-labelledby="painting-testimonials-heading">
      <div className="container">
        <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Testimonials</p>
        <h2
          id="painting-testimonials-heading"
          className="mt-3 text-center text-3xl font-bold text-slate-900 md:text-4xl"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          What Mumbai Homeowners Say
        </h2>

        <div className="relative mx-auto mt-10 max-w-3xl">
          <article className="painting-card p-8 md:p-10">
            <Stars rating={current.rating} />
            <blockquote className="mt-5 text-lg leading-8 text-slate-700 md:text-xl">
              &ldquo;{current.text}&rdquo;
            </blockquote>
            <footer className="mt-6">
              <p className="font-bold text-slate-900">{current.name}</p>
              <p className="text-sm text-slate-500">
                {[current.location, current.projectType].filter(Boolean).join(' · ')}
              </p>
            </footer>
          </article>

          {items.length > 1 && (
            <div className="mt-6 flex items-center justify-center gap-4">
              <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={goPrev} aria-label="Previous testimonial">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="flex gap-2" role="tablist" aria-label="Testimonial slides">
                {items.map((item, i) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={i === index}
                    aria-label={`Testimonial ${i + 1}`}
                    className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-orange-600' : 'w-2 bg-slate-300'}`}
                    onClick={() => setIndex(i)}
                  />
                ))}
              </div>
              <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={goNext} aria-label="Next testimonial">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
