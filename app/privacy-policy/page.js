import Link from 'next/link';
import { BRAND } from '@/lib/brand';

export const metadata = {
  title: `Privacy Policy | ${BRAND.name}`,
  description: `Privacy policy for ${BRAND.name} website and lead forms.`,
  robots: { index: true, follow: true },
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-white py-16 text-slate-800" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="container max-w-3xl">
        <Link href="/" className="text-sm font-bold text-orange-600 hover:text-orange-700">
          ← Back to home
        </Link>
        <h1 className="mt-6 text-4xl font-black text-slate-950" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
          Privacy Policy
        </h1>
        <p className="mt-4 text-sm text-slate-500">Last updated: {new Date().toLocaleDateString('en-IN')}</p>
        <div className="prose prose-slate mt-10 max-w-none space-y-6 text-base leading-8">
          <p>
            {BRAND.name} (&quot;we&quot;, &quot;us&quot;) respects your privacy. This policy explains how we collect and use
            information when you submit forms on our website, including our free interior consultation pages.
          </p>
          <h2 className="text-xl font-black text-slate-950">Information we collect</h2>
          <p>
            When you request a consultation or estimate, we may collect your name, mobile number, city, project details,
            budget preferences, and other information you provide through our forms or AI consultation chat.
          </p>
          <h2 className="text-xl font-black text-slate-950">How we use your information</h2>
          <p>
            We use your details to contact you about interior design services, prepare estimates, schedule site visits,
            and improve our services. We do not sell your personal information to third parties.
          </p>
          <h2 className="text-xl font-black text-slate-950">Contact</h2>
          <p>
            For privacy-related questions, contact us at{' '}
            <a href={`tel:${BRAND.phone.replace(/\s/g, '')}`} className="font-semibold text-orange-600">
              {BRAND.phone}
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
