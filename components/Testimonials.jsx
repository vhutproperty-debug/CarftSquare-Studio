'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Droplets, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BRAND } from '@/lib/brand';
import SectionHeader from '@/components/SectionHeader';

const brand = BRAND.name;
const googleReviewsUrl = (process.env.NEXT_PUBLIC_GOOGLE_REVIEWS_URL || '').trim();

const fallbackTestimonials = [
  {
    name: 'Rhea Shah',
    projectType: 'Residential Interior',
    area: 'Bandra West',
    text: 'CraftSquare Studio transformed our 2BHK with a stunning modular kitchen and custom wardrobes. The design-to-execution process was seamless.',
    rating: 5,
  },
  {
    name: 'Amit Menon',
    projectType: 'Rental Furnishing',
    area: 'Andheri',
    text: 'Booked rental interior furnishing for our investment property. Professional execution, transparent pricing and tenant-ready delivery.',
    rating: 5,
  },
  {
    name: 'Neha & Karan',
    projectType: 'Full Home Interior',
    area: 'Powai',
    text: 'Premium finishes, dedicated project manager and daily updates. Our complete home transformation exceeded expectations.',
    rating: 5,
  },
  {
    name: 'Priya Kapoor',
    projectType: 'Modular Kitchen & Wardrobes',
    area: 'Juhu',
    text: 'CraftSquare Studio handled our complete 3BHK interior — modular kitchen, wardrobes and styling. One point of contact made it stress-free.',
    rating: 5,
  },
];

const brandLogos = ['Hettich', 'Hafele', 'Greenlam', 'Merino', 'Century Ply', 'Ebco'];

export default function Testimonials() {
  const [testimonials, setTestimonials] = useState(fallbackTestimonials);

  useEffect(() => {
    fetch('/api/reviews')
      .then((r) => r.json())
      .then((data) => {
        if (data.reviews?.length) {
          setTestimonials(
            data.reviews.map((r) => ({
              name: r.customerName,
              projectType: r.projectType || 'Interior Project',
              area: r.area || '',
              text: r.reviewText,
              rating: r.rating,
            })),
          );
        }
      })
      .catch(() => {
        // Keep fallback testimonials on error
      });
  }, []);

  const display = testimonials.slice(0, 4);

  return (
    <section
      id="reviews"
      aria-labelledby="customer-reviews-heading"
      className="scroll-mt-24 bg-white py-24"
    >
      <div className="container">
        <SectionHeader
          eyebrow="Customer Reviews"
          title="What Our Clients Say"
          headingId="customer-reviews-heading"
          text={`Real reviews from clients who transformed their spaces with ${brand}'s complete interior solutions.`}
        />
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="grid gap-4 sm:grid-cols-2">
            {display.map((review, index) => (
              <Card
                key={`${review.name}-${review.projectType}-${index}`}
                className="border-slate-100 transition hover:shadow-lg"
              >
                <CardContent className="p-5">
                  <div className="flex gap-1 text-orange-500" aria-label={`${review.rating || 5} out of 5 stars`}>
                    {Array.from({ length: 5 }).map((_, starIndex) => (
                      <Star
                        key={starIndex}
                        className={`h-4 w-4 ${starIndex < (review.rating || 5) ? 'fill-current' : 'text-orange-200'}`}
                      />
                    ))}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">&quot;{review.text}&quot;</p>
                  <p className="mt-4 font-black text-slate-950">{review.name}</p>
                  <p className="text-sm font-semibold text-orange-600">{review.projectType}</p>
                  {review.area ? <p className="text-sm text-slate-500">{review.area}</p> : null}
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
        {googleReviewsUrl ? (
          <div className="mt-10 text-center">
            <a href={googleReviewsUrl} target="_blank" rel="noopener noreferrer">
              <Button className="rounded-full bg-orange-600 px-8 font-black text-white hover:bg-orange-700">
                View More Reviews on Google <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
}
