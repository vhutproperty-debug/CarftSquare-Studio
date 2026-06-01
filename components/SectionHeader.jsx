import { Badge } from '@/components/ui/badge';

export default function SectionHeader({ eyebrow, title, text, light = false }) {
  return (
    <div className="mx-auto mb-10 max-w-3xl text-center">
      <Badge className={`mb-4 ${light ? 'bg-white/20 text-white hover:bg-white/20 border border-white/30' : 'bg-orange-100 text-orange-700 hover:bg-orange-100'}`}>{eyebrow}</Badge>
      <h2 className={`text-3xl font-black tracking-tight md:text-5xl ${light ? 'text-white' : 'text-slate-950'}`} style={{ fontFamily: "'Cormorant Garamond', serif" }}>{title}</h2>
      <p className={`mt-4 text-base leading-7 md:text-lg ${light ? 'text-slate-300' : 'text-slate-600'}`}>{text}</p>
    </div>
  );
}
