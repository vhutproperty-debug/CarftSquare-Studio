import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import SectionHeader from '@/components/SectionHeader';

export default function AboutSection({ about }) {
  if (!about || about.enabled === false) return null;

  return (
    <section id="about" className="bg-gradient-to-br from-slate-50 via-white to-orange-50/30 py-24">
      <div className="container">
        <SectionHeader
          eyebrow={about.homepageEyebrow || 'About Us'}
          title={about.homepageTitle || 'Designing spaces that inspire living'}
          text={about.homepageSubtitle || ''}
        />

        <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-start">
          <div className="space-y-6">
            {about.companyIntroduction && (
              <p className="text-lg leading-8 text-slate-600">{about.companyIntroduction}</p>
            )}
            {about.founderMessage && (
              <Card className="border-orange-100 bg-white shadow-lg">
                <CardContent className="p-6">
                  <Badge className="mb-3 bg-orange-100 text-orange-700 hover:bg-orange-100">Founder&apos;s Message</Badge>
                  <p className="text-sm leading-7 text-slate-600 italic">&ldquo;{about.founderMessage}&rdquo;</p>
                </CardContent>
              </Card>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {about.mission && (
                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">Mission</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{about.mission}</p>
                </div>
              )}
              {about.vision && (
                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">Vision</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{about.vision}</p>
                </div>
              )}
            </div>
            <a href="/about">
              <Button className="bg-orange-600 font-black text-white hover:bg-orange-700 rounded-full">
                Learn more about us <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </div>

          <div className="space-y-6">
            {about.images?.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {about.images.slice(0, 2).map((img, index) => (
                  <div key={img.url || index} className={`overflow-hidden rounded-3xl shadow-xl ${index === 0 ? 'sm:row-span-2' : ''}`}>
                    <img src={img.url} alt={img.alt || 'About CraftSquare Studio'} loading="lazy" className="h-full min-h-[200px] w-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
