'use client';

import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import LeadForm from '@/components/LeadForm';
import { Button } from '@/components/ui/button';
import { whatsappUrl } from '@/lib/brand';

export default function BlogArticleCta({ slug = '' }) {
  return (
    <section
      className="border-t border-slate-100 bg-slate-50 py-12 md:py-16"
      aria-labelledby="blog-article-cta-heading"
      data-blog-cta-slug={slug || undefined}
    >
      <div className="container max-w-3xl">
        <div className="text-center">
          <h2 id="blog-article-cta-heading" className="sr-only">
            Get your free AI interior estimate
          </h2>
          <Link href="/estimate" className="inline-block w-full sm:w-auto">
            <Button
              type="button"
              className="h-14 w-full rounded-full bg-orange-600 px-8 text-base font-black text-white shadow-lg shadow-orange-200 transition hover:bg-orange-700 sm:min-w-[320px]"
            >
              Get Your Free AI Interior Estimate
            </Button>
          </Link>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-600">
            Get your personalized AI-powered interior cost estimate in under 60 seconds.
          </p>
        </div>

        <div className="mt-10">
          <LeadForm source="blog_article" />
        </div>

        <p className="mt-6 text-center text-sm font-semibold text-slate-600">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 text-emerald-700 underline-offset-4 hover:text-emerald-800 hover:underline"
          >
            <MessageCircle className="h-4 w-4 shrink-0" />
            Talk to an Interior Designer on WhatsApp
          </a>
        </p>
      </div>
    </section>
  );
}
