import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Hammer,
  Home,
  Layers,
  Paintbrush,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import SectionHeader from '@/components/SectionHeader';

const iconMap = {
  Paintbrush,
  Building2,
  ShieldCheck,
  Sparkles,
  Home,
  Hammer,
  BadgeCheck,
  Layers,
};

export default function Services({ services = [] }) {
  return (
    <section id="services" className="bg-white py-24">
      <div className="container">
        <SectionHeader
          eyebrow="Our Services"
          title="Complete interior solutions for every space"
          text="From residential and commercial interiors to modular kitchens, wardrobes and rental furnishing — design-to-execution under one roof."
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((service) => {
            const Icon = iconMap[service.icon] || Sparkles;
            return (
              <Card key={service.id} className="group border-slate-100 bg-white transition duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-orange-950/10">
                <CardContent className="p-6">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-700 transition group-hover:scale-110 group-hover:bg-orange-600 group-hover:text-white">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-black text-slate-950">{service.title}</h3>
                  <p className="mt-2 text-sm font-bold text-orange-600">{service.price}</p>
                  <p className="mt-3 min-h-[72px] text-sm leading-6 text-slate-600">{service.description}</p>
                  <a href={`/services/${service.slug || service.id}`} className="mt-5 inline-flex items-center text-sm font-black text-slate-950">
                    Learn more <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
