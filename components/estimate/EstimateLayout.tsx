import Link from 'next/link';
import { BRAND } from '@/lib/brand';
import BrandLogo from '@/components/BrandLogo';
import './estimate-animations.css';

export default function EstimateLayout({
  children,
  title,
  subtitle,
  stepLabel,
  premium = false,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  stepLabel?: string;
  premium?: boolean;
}) {
  if (!premium) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50/30 text-slate-950" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <header className="border-b border-slate-100 bg-white/90 backdrop-blur">
          <div className="container flex h-16 items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <BrandLogo variant="nav" />
            </Link>
            <Link href="/" className="text-sm font-semibold text-slate-600 hover:text-orange-600">
              Back to website
            </Link>
          </div>
        </header>
        <main className="container py-8 md:py-12">
          <div className="mx-auto mb-8 max-w-3xl text-center">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">{BRAND.name}</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              {title}
            </h1>
            {subtitle && <p className="mt-4 text-base leading-7 text-slate-600 md:text-lg">{subtitle}</p>}
          </div>
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50/30 text-slate-950" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <header className="border-b border-white/60 bg-white/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <BrandLogo variant="nav" />
          </Link>
          <Link href="/" className="text-sm font-semibold text-slate-600 hover:text-orange-600 transition-colors">
            Back to website
          </Link>
        </div>
      </header>

      <section className="flex min-h-[42vh] flex-col items-center justify-center px-4 py-20 md:min-h-[48vh] md:py-28">
        <div className="estimate-fade-in mx-auto max-w-3xl text-center">
          {stepLabel && (
            <p className="mb-6 text-xs font-bold uppercase tracking-[0.22em] text-orange-600">
              {stepLabel}
            </p>
          )}
          <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">{BRAND.name}</p>
          <h1
            className="mt-4 text-4xl font-black tracking-tight md:text-6xl md:leading-tight"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-slate-600 md:text-lg md:leading-9">
              {subtitle}
            </p>
          )}
        </div>
      </section>

      <main className="container pb-16 md:pb-24">
        {children}
      </main>
    </div>
  );
}
