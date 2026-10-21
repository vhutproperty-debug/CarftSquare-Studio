import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { BRAND, whatsappUrl } from '@/lib/brand';
import { getSiteDomain, getSiteUrl } from '@/lib/site';
import BrandLogo from '@/components/BrandLogo';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';

const BODY_FONT = { fontFamily: "'DM Sans', sans-serif" };
const HEADING_FONT = { fontFamily: "'Cormorant Garamond', serif" };

function formatLastUpdated(date = new Date()) {
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getOfficialEmail() {
  return `notifications@${getSiteDomain()}`;
}

function Section({ title, children }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-black text-slate-950 md:text-2xl" style={HEADING_FONT}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function BulletList({ items }) {
  return (
    <ul className="list-disc space-y-2 pl-5 text-slate-700">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function SiteNav() {
  return (
    <nav className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/95 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between gap-3">
        <Link href="/" className="flex items-center">
          <BrandLogo variant="nav" />
        </Link>
        <div className="hidden items-center gap-5 text-sm font-semibold text-slate-300 md:flex">
          <Link href="/privacy-policy" className="transition-colors hover:text-white">
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-white">
            Terms
          </Link>
        </div>
        <a href={whatsappUrl} target="_blank" rel="noreferrer">
          <Button className="rounded-full bg-emerald-600 font-bold text-white hover:bg-emerald-700">
            <MessageCircle className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">WhatsApp</span>
          </Button>
        </a>
      </div>
    </nav>
  );
}

export default function DataDeletionPage() {
  const lastUpdated = formatLastUpdated();
  const officialEmail = getOfficialEmail();
  const websiteUrl = getSiteUrl();
  const phoneHref = `tel:${BRAND.phone.replace(/\s/g, '')}`;

  return (
    <>
      <main className="min-h-screen bg-white text-slate-800" style={BODY_FONT}>
        <SiteNav />

        <div className="border-b border-slate-100 bg-slate-50/80 py-12 md:py-16">
          <div className="container max-w-3xl">
            <Link href="/" className="text-sm font-bold text-orange-600 hover:text-orange-700">
              ← Back to home
            </Link>
            <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-orange-600">
              Last updated: {lastUpdated}
            </p>
            <h1
              className="mt-3 text-4xl font-black tracking-tight text-slate-950 md:text-5xl"
              style={HEADING_FONT}
            >
              Data deletion
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-600 md:text-lg">
              Use this page to request deletion of personal information CraftSquare holds from
              website forms, WhatsApp, or Meta (Facebook / Instagram) lead ads.
            </p>
          </div>
        </div>

        <article className="container max-w-3xl py-12 md:py-16">
          <div className="space-y-10 text-base leading-8 text-slate-700">
            <Section title="How to request deletion">
              <p>
                Email{' '}
                <a href={`mailto:${officialEmail}?subject=Data%20deletion%20request`} className="font-semibold text-orange-600 hover:text-orange-700">
                  {officialEmail}
                </a>{' '}
                with the subject &quot;Data deletion request&quot; and include:
              </p>
              <BulletList
                items={[
                  'Your full name',
                  'The phone number and/or email you used',
                  'How you contacted us (website form, WhatsApp, Facebook/Instagram lead ad)',
                ]}
              />
              <p>
                You can also WhatsApp or call {BRAND.phone}. We may verify it is you before we
                delete the record.
              </p>
            </Section>

            <Section title="What we delete">
              <p>
                We delete or anonymise enquiry records we control (name, phone, email, messages,
                and related lead notes), except where we must keep a limited record for law,
                dispute, or accounting. Meta also keeps data under its own policies; we cannot
                erase your Facebook or WhatsApp account.
              </p>
            </Section>

            <Section title="Timing">
              <p>
                We aim to complete deletion within 30 days of a verified request. Related pages:{' '}
                <Link href="/privacy-policy" className="font-semibold text-orange-600 hover:text-orange-700">
                  Privacy Policy
                </Link>{' '}
                and{' '}
                <Link href="/terms" className="font-semibold text-orange-600 hover:text-orange-700">
                  Terms of Use
                </Link>
                .
              </p>
            </Section>

            <Section title="Contact">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-800">
                <p className="font-black text-slate-950">{BRAND.name}</p>
                <ul className="mt-4 space-y-2 text-sm md:text-base">
                  <li>
                    <span className="font-semibold text-slate-950">Official Email: </span>
                    <a href={`mailto:${officialEmail}`} className="text-orange-600 hover:text-orange-700">
                      {officialEmail}
                    </a>
                  </li>
                  <li>
                    <span className="font-semibold text-slate-950">Official Phone: </span>
                    <a href={phoneHref} className="text-orange-600 hover:text-orange-700">
                      {BRAND.phone}
                    </a>
                  </li>
                  <li>
                    <span className="font-semibold text-slate-950">Website: </span>
                    <a href={websiteUrl} className="text-orange-600 hover:text-orange-700">
                      {websiteUrl.replace(/^https?:\/\//, '')}
                    </a>
                  </li>
                </ul>
              </div>
            </Section>
          </div>
        </article>
      </main>

      <Footer />
    </>
  );
}
