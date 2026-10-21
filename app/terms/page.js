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
          <Link href="/#services" className="transition-colors hover:text-white">
            Services
          </Link>
          <Link href="/about" className="transition-colors hover:text-white">
            About
          </Link>
          <Link href="/gallery" className="transition-colors hover:text-white">
            Gallery
          </Link>
          <Link href="/painting" className="transition-colors hover:text-white">
            Painting
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

export default function TermsOfUsePage() {
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
              Terms of Use
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-600 md:text-lg">
              These Terms of Use govern your access to the {BRAND.name} website, WhatsApp
              communications, and related interior design, furnishing, and property enquiry
              services. By using our site or messaging us, you agree to these terms.
            </p>
          </div>
        </div>

        <article className="container max-w-3xl py-12 md:py-16">
          <div className="space-y-10 text-base leading-8 text-slate-700">
            <Section title="Who we are">
              <p>
                {BRAND.name} (&quot;CraftSquare&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates
                this website and related tools for CraftSquare Studio (interiors, painting, and
                furnishing) and CraftSquare Properties (Mumbai rentals and resale enquiries). Our
                Meta app &quot;Craftsquare Ops&quot; is an internal operations tool used by our staff
                to manage Page ads, leads, and WhatsApp Business messages. It is not a consumer
                login product.
              </p>
            </Section>

            <Section title="Acceptance">
              <p>
                If you do not agree to these Terms of Use or our{' '}
                <Link href="/privacy-policy" className="font-semibold text-orange-600 hover:text-orange-700">
                  Privacy Policy
                </Link>
                , do not use the website, submit forms, or continue a WhatsApp conversation with us.
                We may update these terms; the &quot;Last updated&quot; date above is the current
                version. Continued use after a change means you accept the revised terms.
              </p>
            </Section>

            <Section title="What the website and tools do">
              <p>You may use CraftSquare channels to:</p>
              <BulletList
                items={[
                  'Browse services, projects, and content',
                  'Submit an enquiry, estimate request, or consultation form',
                  'Message us on WhatsApp about interiors or property',
                  'See ads or lead forms associated with our Facebook Page',
                ]}
              />
              <p>
                An enquiry, chat, or online estimate is not a binding contract. Prices, listings,
                and timelines are indicative until confirmed in writing by CraftSquare or the
                property owner.
              </p>
            </Section>

            <Section title="Your responsibilities">
              <BulletList
                items={[
                  'Provide accurate contact and project information',
                  'Use the site and WhatsApp only for lawful personal or business enquiries',
                  'Do not scrape, copy, reverse engineer, or overload our systems',
                  'Do not impersonate others or submit false leads',
                  'Do not use our Meta Page, ads, or WhatsApp number to spam or harass',
                ]}
              />
            </Section>

            <Section title="Facebook, Instagram, WhatsApp, and ads">
              <p>
                If you interact with CraftSquare through Meta products (Facebook Page, Instagram,
                WhatsApp, Lead Ads, or Pixel/CAPI measurement), Meta’s terms also apply. We use
                those platforms to receive enquiries and to run ads for our own Page and ad
                account. We do not sell an ads or messaging product to other businesses through
                this website.
              </p>
              <p>
                To request deletion of personal data we hold, use{' '}
                <Link href="/data-deletion" className="font-semibold text-orange-600 hover:text-orange-700">
                  Data deletion
                </Link>{' '}
                or contact us using the details below.
              </p>
            </Section>

            <Section title="Intellectual property">
              <p>
                Website design, text, logos, photographs, and estimates we produce remain
                CraftSquare’s property or that of our licensors, unless we agree otherwise in
                writing. You may not reuse them for competing marketing without permission.
              </p>
            </Section>

            <Section title="Limitation of liability">
              <p>
                The website and complimentary tools are provided as-is. To the extent permitted by
                Indian law, CraftSquare is not liable for indirect or consequential loss arising
                from website downtime, third-party platforms (including Meta), or indicative prices
                or listings that change before written confirmation. Nothing in these terms limits
                liability that cannot be excluded by law.
              </p>
            </Section>

            <Section title="Governing law">
              <p>
                These terms are governed by the laws of India. Courts in Mumbai, Maharashtra have
                exclusive jurisdiction, without prejudice to any consumer rights that cannot be
                waived.
              </p>
            </Section>

            <Section title="Contact">
              <p>Questions about these Terms of Use:</p>
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
