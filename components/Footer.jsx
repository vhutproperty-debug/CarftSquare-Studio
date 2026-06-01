import { BRAND, whatsappUrl } from '@/lib/brand';
import BrandLogo from '@/components/BrandLogo';

const brand = BRAND.name;

export default function Footer() {
  return (
    <footer className="bg-white py-12">
      <div className="container">
        <div className="grid gap-8 md:grid-cols-4 mb-8">
          <div>
            <div className="mb-4">
              <BrandLogo variant="footer" />
            </div>
            <p className="text-sm text-slate-500">Premium interior design and complete interior solutions. Mumbai&apos;s trusted design-to-execution partner.</p>
          </div>
          <div>
            <h4 className="font-black text-slate-950 mb-3">Services</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><a href="#services" className="hover:text-orange-600">Interior Services</a></li>
              <li><a href="/rental-interiors" className="hover:text-orange-600">Rental Furnishing</a></li>
              <li><a href="#modular-kitchen" className="hover:text-orange-600">Modular Kitchen</a></li>
              <li><a href="#wardrobes" className="hover:text-orange-600">Wardrobes</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-black text-slate-950 mb-3">Company</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><a href="/about" className="hover:text-orange-600">About Us</a></li>
              <li><a href="/gallery" className="hover:text-orange-600">Gallery</a></li>
              <li><a href="#projects" className="hover:text-orange-600">Projects</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-black text-slate-950 mb-3">Contact</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><a href="tel:+917304242604" className="hover:text-orange-600">+91 73042 42604</a></li>
              <li><a href={whatsappUrl} target="_blank" rel="noreferrer" className="hover:text-orange-600">WhatsApp</a></li>
              <li><a href="/admin" className="hover:text-orange-600">Admin Portal</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-100 pt-6 flex flex-col gap-2 md:flex-row md:justify-between text-xs text-slate-400">
          <p>© 2025 {brand}. Premium interior design & solutions in Mumbai.</p>
          <p>Interior Design Mumbai • Modular Kitchen Mumbai • Rental Interiors Mumbai • Turnkey Interiors Mumbai</p>
        </div>
      </div>
    </footer>
  );
}
