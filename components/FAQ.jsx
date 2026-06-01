import { Card, CardContent } from '@/components/ui/card';
import SectionHeader from '@/components/SectionHeader';

export default function FAQ({ faqs = [] }) {
  return (
    <section className="bg-slate-50 py-24">
      <div className="container max-w-4xl">
        <SectionHeader eyebrow="FAQ" title="Mumbai home transformation questions answered" text="Fast answers to the highest-converting buyer objections before booking inspection." />
        <div className="space-y-4">
          {faqs.map((faq) => (
            <Card key={faq.q} className="border-slate-100 bg-white transition hover:shadow-md">
              <CardContent className="p-6">
                <h3 className="font-black text-slate-950">{faq.q}</h3>
                <p className="mt-2 leading-7 text-slate-600">{faq.a}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
