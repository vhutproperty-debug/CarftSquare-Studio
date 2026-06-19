'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function BlogPartnerArticleCta({ slug = '' }) {
  return (
    <section
      className="border-t border-slate-100 bg-slate-50 py-12 md:py-16"
      aria-labelledby="blog-partner-cta-heading"
      data-blog-cta-slug={slug || undefined}
      data-blog-cta-type="partner"
    >
      <div className="container max-w-3xl text-center">
        <h2
          id="blog-partner-cta-heading"
          className="text-3xl font-black text-slate-950 md:text-4xl"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          Become a CraftSquare Referral Partner
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-600">
          Turn your existing property clients into additional income.
        </p>
        <p className="mx-auto mt-6 max-w-xl text-lg font-bold leading-8 text-slate-900">
          Potential referral earnings:
          <span className="mt-1 block text-orange-600">₹50,000–₹2,00,000+ per month*</span>
        </p>
        <p className="mx-auto mt-2 max-w-lg text-xs text-slate-500">
          *depends on successful referrals and completed projects
        </p>
        <Link href="/partner#register" className="mt-8 inline-block w-full sm:w-auto">
          <Button
            type="button"
            className="h-14 w-full rounded-full bg-orange-600 px-8 text-base font-black text-white shadow-lg shadow-orange-200 transition hover:bg-orange-700 sm:min-w-[320px]"
          >
            Become a Referral Partner
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Link>
      </div>
    </section>
  );
}
