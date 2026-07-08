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

export default function PrivacyPolicyPage() {
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
              Privacy Policy
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-600 md:text-lg">
              This policy describes how {BRAND.name} handles personal information when you visit our
              website, submit enquiry forms, or interact with our painting, interior design, and
              related services.
            </p>
          </div>
        </div>

        <article className="container max-w-3xl py-12 md:py-16">
          <div className="space-y-10 text-base leading-8 text-slate-700">
            <Section title="Introduction">
              <p>
                {BRAND.name} (&quot;CraftSquare&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) provides
                professional painting, interior design, modular interiors, and related home and
                commercial improvement services in Mumbai and surrounding areas. To deliver these
                services, respond to enquiries, and improve your experience, we collect and process
                certain personal information as described in this Privacy Policy.
              </p>
              <p>
                By using our website, submitting a form, or communicating with us, you acknowledge
                that you have read and understood this policy. If you do not agree with our
                practices, please do not submit personal information through our channels.
              </p>
            </Section>

            <Section title="Information We Collect">
              <p>Depending on how you interact with CraftSquare, we may collect:</p>
              <BulletList
                items={[
                  'Name',
                  'Phone number',
                  'Email address',
                  'Property location (city, locality, or address details you provide)',
                  'Project details such as property type, scope, budget, and timeline',
                  'Uploaded images of your property or project',
                  'Messages and information submitted through website forms, chat, or consultation tools',
                  'Device and browser information (such as IP address, browser type, operating system, and screen resolution)',
                  'Cookies and similar technologies used for site functionality and analytics',
                ]}
              />
              <p>
                We collect only the information needed to understand your requirements and provide
                the services you request.
              </p>
            </Section>

            <Section title="How We Use Information">
              <p>We use the information we collect to:</p>
              <BulletList
                items={[
                  'Contact you regarding your enquiry or project',
                  'Schedule site visits and consultations',
                  'Prepare quotations and service proposals',
                  'Deliver the painting, interior design, or related services you request',
                  'Improve customer experience, service quality, and website usability',
                  'Send marketing communications where you have given consent or where permitted by law',
                  'Measure website performance and understand how visitors use our services through analytics',
                ]}
              />
            </Section>

            <Section title="Meta Lead Ads">
              <p>
                When you submit your details through Facebook or Instagram Lead Ads operated by
                CraftSquare, the information you provide is used solely to respond to your enquiry
                and deliver the painting, interior design, or related services you have requested.
              </p>
              <p>
                Lead data from Meta platforms is not used for unrelated marketing, is not sold to
                third parties, and is handled in accordance with this Privacy Policy and applicable
                data protection requirements.
              </p>
            </Section>

            <Section title="Data Sharing">
              <p>
                CraftSquare does not sell your personal information. We do not rent or trade your
                data to advertisers or data brokers.
              </p>
              <p>
                We may share limited personal information with trusted service providers only when
                necessary to operate our business and deliver requested services—for example,
                communication tools, cloud storage, analytics platforms, payment processors, or
                project management systems. These providers are expected to handle data securely and
                only for the purposes we specify.
              </p>
              <p>
                We may also disclose information when required by law, regulation, legal process, or
                to protect the rights, safety, and security of CraftSquare, our customers, or
                others.
              </p>
            </Section>

            <Section title="Data Security">
              <p>
                We implement reasonable administrative, technical, and organisational safeguards
                designed to protect personal information against unauthorised access, alteration,
                disclosure, or loss. These measures may include access controls, secure
                transmission where appropriate, and limiting internal access to customer data on a
                need-to-know basis.
              </p>
              <p>
                No method of transmission or storage is completely secure. While we work to protect
                your information, we cannot guarantee absolute security.
              </p>
            </Section>

            <Section title="Cookies">
              <p>
                Our website uses cookies and similar technologies to enable core functionality,
                remember preferences, and understand how visitors interact with our pages. Analytics
                cookies help us measure traffic, form performance, and improve the website
                experience.
              </p>
              <p>
                You can control cookies through your browser settings. Disabling certain cookies may
                affect how some parts of the website function.
              </p>
            </Section>

            <Section title="User Rights">
              <p>
                Subject to applicable law, you may request the following regarding your personal
                information held by CraftSquare:
              </p>
              <BulletList
                items={[
                  'Access to the personal information we hold about you',
                  'Correction of inaccurate or incomplete information',
                  'Deletion of your personal information, where applicable',
                  'Contact with us regarding how your data is collected, used, or stored',
                ]}
              />
              <p>
                To exercise these rights, please contact us using the details in the Contact section
                below. We may need to verify your identity before processing certain requests.
              </p>
            </Section>

            <Section title="Third-Party Services">
              <p>
                CraftSquare may integrate with third-party platforms and tools to operate our
                website, manage leads, deliver services, and measure performance. These may
                include, now or in the future, services such as:
              </p>
              <BulletList
                items={[
                  'Meta (Facebook and Instagram advertising, Lead Ads, and conversion measurement)',
                  'Google Analytics and related Google measurement tools',
                  'Cloudinary or similar media hosting and delivery platforms',
                  'Customer relationship management (CRM) and business communication systems',
                ]}
              />
              <p>
                Third-party services are governed by their own privacy policies and terms. We
                encourage you to review those policies where relevant. CraftSquare selects providers
                with care and limits the data shared to what is necessary for the intended purpose.
              </p>
            </Section>

            <Section title="Contact">
              <p>
                For privacy-related questions, data requests, or concerns about how your information
                is handled, please contact:
              </p>
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

            <Section title="Changes to This Policy">
              <p>
                We may update this Privacy Policy from time to time to reflect changes in our
                practices, services, or legal requirements. The &quot;Last updated&quot; date at the top of
                this page indicates when the policy was most recently revised. Continued use of our
                website or services after updates constitutes acceptance of the revised policy.
              </p>
            </Section>
          </div>
        </article>
      </main>

      <Footer />
    </>
  );
}
